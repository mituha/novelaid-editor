import fs from 'fs/promises';
import path from 'path';
import { dialog, BrowserWindow } from 'electron';
import { MetadataService } from '../metadataService';
import { readDocument, saveDocument } from '../metadata';

const LOG_PREFIX = '[FileService]';

export class FileService {
  private static instance: FileService;
  private attributeCache = new Map<string, { mtime: number; data: Map<string, string> }>();
  private beforeDeleteCallback: ((targetPath: string, reason: string) => void) | null = null;

  private constructor() {}

  public setBeforeDeleteCallback(callback: (targetPath: string, reason: string) => void) {
    this.beforeDeleteCallback = callback;
  }

  /** .novelaidattributes が変更されたとき、対象ディレクトリのキャッシュを破棄します */
  public invalidateAttributeCache(dirPath: string) {
    console.log(`${LOG_PREFIX} invalidateAttributeCache: ${dirPath}`);
    this.attributeCache.delete(dirPath);
  }

  public static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
  }

  public async openDirectory(window: BrowserWindow): Promise<string | null> {
    console.log(`${LOG_PREFIX} openDirectory: ダイアログを表示`);
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      properties: ['openDirectory'],
    });
    if (canceled) {
      console.log(`${LOG_PREFIX} openDirectory: キャンセルされました`);
      return null;
    }
    console.log(`${LOG_PREFIX} openDirectory: 選択されたディレクトリ: ${filePaths[0]}`);
    return filePaths[0];
  }

  public async getDocumentType(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.ch') return 'chat';
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext))
      return 'image';
    if (ext === '.txt') return 'novel';
    if (ext !== '.md' && ext !== '.markdown') return 'markdown';

    // mdファイルに対する特別な処理の確認
    // 基本的にはmdをnovel用として扱っている場合の特殊処理用です
    // *.md novel を処理することになります。
    // また、その際に特定ファイルを除外する場合もあります
    // plot.md markdown など

    const dirPath = path.dirname(filePath);
    const fileName = path.basename(filePath);

    // 1. .novelaidattributes をチェック (最優先)
    const attrs = await this.getAttributesForDirectory(dirPath);
    if (attrs) {
      let matchedType: string | null = null;
      for (const [pattern, type] of attrs.entries()) {
        if (!pattern.endsWith('/') && pattern !== './' && this.patternMatches(pattern, fileName)) {
          matchedType = type;
        }
      }
      if (matchedType) return matchedType;
    }
    //特殊処理を行わなかったマークダウンファイルはマークダウンです
    //フォルダーの属性によるフォールバック処理は不要です。
    return 'markdown';
  }

  /**
   * パターンが対象の文字列にマッチするか判定します。
   * シンプルなワイルドカード (*) をサポートします。
   */
  private patternMatches(pattern: string, target: string): boolean {
    if (pattern === target) return true;
    if (!pattern.includes('*') && !pattern.includes('?')) return false;

    // 正規表現の特殊文字 (* ? 以外) をエスケープしてから、* と ? をワイルドカードとして展開
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // * ? 以外の特殊文字をエスケープ
      .replace(/\*/g, '.*')                  // * → .*
      .replace(/\?/g, '.');                  // ? → .
    const regex = new RegExp(`^${regexStr}$`, 'i');
    return regex.test(target);
  }

  /**
   * .novelaidattributes を読み込み、パース結果を返します。
   */
  private async getAttributesForDirectory(dirPath: string): Promise<Map<string, string> | null> {
    const attrPath = path.join(dirPath, '.novelaidattributes');
    try {
      const stats = await fs.stat(attrPath);
      const cached = this.attributeCache.get(dirPath);
      if (cached && cached.mtime === stats.mtimeMs) {
        return cached.data;
      }

      const content = await fs.readFile(attrPath, 'utf-8');
      const data = new Map<string, string>();
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const [pattern, type] = trimmed.split(/\s+/);
        if (pattern && type) {
          data.set(pattern, type);
        }
      }

      this.attributeCache.set(dirPath, { mtime: stats.mtimeMs, data });
      return data;
    } catch (err) {
      return null;
    }
  }

  /**
   * ディレクトリ名から、そのディレクトリ内での優先ドキュメントタイプを推定します。
   * 名前から判定できない場合、親ディレクトリのタイプを継承します。
   */
  public async getPreferredDocumentTypeForDirectory(dirPath: string): Promise<string> {
    const dirName = path.basename(dirPath).toLowerCase();

    // 1. 自分自身の .novelaidattributes `./` を確認
    const ownAttrs = await this.getAttributesForDirectory(dirPath);
    if (ownAttrs?.has('./')) {
      return ownAttrs.get('./')!;
    }

    // 2. 親の .novelaidattributes `dirName/` を確認
    const parentPath = path.dirname(dirPath);
    if (parentPath !== dirPath && parentPath !== '.') {
      const parentAttrs = await this.getAttributesForDirectory(parentPath);
      if (parentAttrs) {
        const dirKeyword = `${path.basename(dirPath)}/`;
        // 後ろの設定が優先されるように、パース順（挿入順）を考慮して最後に見つかったものを採用
        let matchedType: string | null = null;
        for (const [pattern, type] of parentAttrs.entries()) {
          // ディレクトリパターンの場合（/で終わる）
          if (pattern.endsWith('/') && this.patternMatches(pattern, dirKeyword)) {
            matchedType = type;
          }
        }
        if (matchedType) return matchedType;
      }
    }

    // 3. 仕様に基づいたキーワードによる判定
    const novelKeywords = ['novel', '小説'];
    const markdownKeywords = ['設定', 'プロット', '資料', 'wiki'];
    const imageKeywords = ['image', '画像'];
    const chatKeywords = ['chat', 'チャット', 'channel', 'チャンネル'];

    if (novelKeywords.some((kw) => dirName.includes(kw))) {
      return 'novel';
    }
    if (markdownKeywords.some((kw) => dirName.includes(kw))) {
      return 'markdown';
    }
    if (imageKeywords.some((kw) => dirName.includes(kw))) {
      return 'image';
    }
    if (chatKeywords.some((kw) => dirName.includes(kw))) {
      return 'chat';
    }

    // 4. 名前から判定できない場合、親フォルダのタイプを継承
    if (parentPath !== dirPath && parentPath !== '.') {
      return await this.getPreferredDocumentTypeForDirectory(parentPath);
    }

    // 5. デフォルト
    return 'novel';
  }

  public async readDirectory(dirPath: string) {
    console.log(`${LOG_PREFIX} readDirectory: ${dirPath}`);
    const metadataService = MetadataService.getInstance();
    const dirents = await fs.readdir(dirPath, { withFileTypes: true });
    const filtered = dirents.filter((dirent) => {
      const fullPath = path.join(dirPath, dirent.name);
      // Skip if ignored by .novelaidignore
      if (metadataService.isIgnored(fullPath)) {
        return false;
      }

      // Filter out only hidden folders and node_modules, keep hidden files
      if (dirent.isDirectory()) {
        return !dirent.name.startsWith('.') && dirent.name !== 'node_modules';
      }
      return true;
    });

    console.log(`${LOG_PREFIX} readDirectory: ${filtered.length} 件のエントリを返します (${dirPath})`);
    return await Promise.all(
      filtered.map(async (dirent) => {
        const fullPath = path.join(dirPath, dirent.name);
        const isDirectory = dirent.isDirectory();
        return {
          name: dirent.name,
          isDirectory,
          path: fullPath,
          documentType: isDirectory
            ? await this.getPreferredDocumentTypeForDirectory(fullPath)
            : await this.getDocumentType(fullPath),
          metadata: isDirectory
            ? undefined
            : metadataService.queryByPath?.(fullPath),
        };
      }),
    );
  }

  public async readFile(filePath: string): Promise<string> {
    console.log(`${LOG_PREFIX} readFile: ${filePath}`);
    return await fs.readFile(filePath, 'utf-8');
  }

  public async writeFile(filePath: string, content: string): Promise<void> {
    console.log(`${LOG_PREFIX} writeFile: ${filePath} (${content.length} 文字)`);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  public async readDocument(filePath: string) {
    console.log(`${LOG_PREFIX} readDocument: ${filePath}`);
    return await readDocument(filePath);
  }

  public async saveDocument(filePath: string, data: any) {
    console.log(`${LOG_PREFIX} saveDocument: ${filePath}`);
    return await saveDocument(filePath, data);
  }

  public async createFile(filePath: string): Promise<boolean> {
    console.log(`${LOG_PREFIX} createFile: ${filePath}`);
    await fs.writeFile(filePath, '', 'utf-8');
    return true;
  }

  /**
   * 未命名のドキュメントを適切なフォルダ形式と名前で作成します。
   */
  public async createUntitledDocument(dirPath: string): Promise<string> {
    console.log(`${LOG_PREFIX} createUntitledDocument: ${dirPath}`);
    const dirType = await this.getPreferredDocumentTypeForDirectory(dirPath);
    let baseName = '新規小説';
    let ext = '.txt';

    if (dirType === 'markdown') {
      baseName = '新規設定';
      ext = '.md';
    } else if (dirType === 'chat') {
      baseName = '#新規チャット';
      ext = '.ch';
    }

    const uniquePath = await this.getUniquePath(dirPath, baseName, ext);
    console.log(`${LOG_PREFIX} createUntitledDocument: 作成するパス: ${uniquePath}`);
    await fs.writeFile(uniquePath, '', 'utf-8');
    return uniquePath;
  }

  /**
   * 重複しないファイルパスを生成します。
   */
  public async getUniquePath(
    dirPath: string,
    baseName: string,
    ext: string,
  ): Promise<string> {
    let filePath = path.join(dirPath, `${baseName}${ext}`);
    let counter = 2;

    while (true) {
      try {
        await fs.access(filePath);
        // ファイルが存在する場合は連番を付与
        filePath = path.join(dirPath, `${baseName}(${counter})${ext}`);
        counter++;
      } catch {
        // ファイルが存在しない場合はこのパスを使用
        break;
      }
    }
    return filePath;
  }

  public async createDirectory(dirPath: string): Promise<boolean> {
    console.log(`${LOG_PREFIX} createDirectory: ${dirPath}`);
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  }

  public async rename(oldPath: string, newPath: string): Promise<boolean> {
    console.log(`${LOG_PREFIX} rename: ${oldPath} → ${newPath}`);
    await fs.rename(oldPath, newPath);
    return true;
  }

  public async move(oldPath: string, newPath: string): Promise<boolean> {
    console.log(`${LOG_PREFIX} move: ${oldPath} → ${newPath}`);
    await fs.rename(oldPath, newPath);
    return true;
  }

  public async copy(srcPath: string, destPath: string): Promise<boolean> {
    console.log(`${LOG_PREFIX} copy: ${srcPath} → ${destPath}`);
    await fs.cp(srcPath, destPath, { recursive: true });
    return true;
  }

  public async delete(targetPath: string): Promise<boolean> {
    console.log(`${LOG_PREFIX} delete: ${targetPath}`);
    if (this.beforeDeleteCallback) {
      this.beforeDeleteCallback(targetPath, 'deleted');
    }
    await fs.rm(targetPath, { recursive: true, force: true });
    return true;
  }
}
