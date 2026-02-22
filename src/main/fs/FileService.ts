import fs from 'fs/promises';
import path from 'path';
import { dialog, BrowserWindow } from 'electron';
import { MetadataService } from '../metadataService';
import { readDocument, saveDocument } from '../metadata';

export class FileService {
  private static instance: FileService;
  private ignoreCache = new Map<string, { mtime: number; instance: any }>();

  private constructor() {}

  public static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
  }

  public async openDirectory(window: BrowserWindow): Promise<string | null> {
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      properties: ['openDirectory'],
    });
    if (canceled) {
      return null;
    }
    return filePaths[0];
  }

  private async findProjectRoot(filePath: string): Promise<string | null> {
    let current = path.dirname(filePath);
    const root = path.parse(current).root;
    const NOVELAID_DIR = '.novelaid';

    while (current !== root) {
      try {
        await fs.access(path.join(current, NOVELAID_DIR));
        return current;
      } catch {
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
      }
    }
    return null;
  }

  public async getDocumentType(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.ch') return 'ch';
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext))
      return 'image';
    if (ext === '.txt') return 'novel';
    if (ext !== '.md' && ext !== '.markdown') return 'markdown';

    // .md / .markdown の場合、.novelignore をチェック
    const projectRoot = await this.findProjectRoot(filePath);
    if (!projectRoot) return 'novel'; // デフォルトは novel

    const ignorePath = path.join(projectRoot, '.novelignore');
    try {
      const stats = await fs.stat(ignorePath);
      let ignoreInstance;

      const cached = this.ignoreCache.get(projectRoot);
      if (cached && cached.mtime === stats.mtimeMs) {
        ignoreInstance = cached.instance;
      } else {
        const ignore = require('ignore');
        const content = await fs.readFile(ignorePath, 'utf-8');
        ignoreInstance = ignore().add(content);
        this.ignoreCache.set(projectRoot, {
          mtime: stats.mtimeMs,
          instance: ignoreInstance,
        });
      }

      const relativePath = path.relative(projectRoot, filePath);
      // ignore package expects forward slashes
      const normalizedRelativePath = relativePath.replace(/\\/g, '/');

      if (ignoreInstance.ignores(normalizedRelativePath)) {
        return 'markdown';
      }
    } catch (err) {
      // .novelignore がない場合は無視してデフォルト(novel)を返す
    }

    // フォルダ名による判定(フォールバック)
    return this.getPreferredDocumentTypeForDirectory(path.dirname(filePath));
  }

  /**
   * ディレクトリ名から、そのディレクトリ内での優先ドキュメントタイプを推定します。
   */
  public getPreferredDocumentTypeForDirectory(dirPath: string): string {
    const dirName = path.basename(dirPath).toLowerCase();

    // 仕様に基づいたキーワードによる判定
    const novelKeywords = ['novel', '小説'];
    const markdownKeywords = ['設定', 'プロット', '資料', 'wiki'];

    if (novelKeywords.some((kw) => dirName.includes(kw))) {
      return 'novel';
    }
    if (markdownKeywords.some((kw) => dirName.includes(kw))) {
      return 'markdown';
    }

    // デフォルト
    return 'novel';
  }

  public async readDirectory(dirPath: string) {
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

    return await Promise.all(
      filtered.map(async (dirent) => {
        const fullPath = path.join(dirPath, dirent.name);
        const isDirectory = dirent.isDirectory();
        return {
          name: dirent.name,
          isDirectory,
          path: fullPath,
          language: isDirectory
            ? this.getPreferredDocumentTypeForDirectory(fullPath)
            : await this.getDocumentType(fullPath),
          metadata: isDirectory
            ? undefined
            : metadataService.queryByPath?.(fullPath),
        };
      }),
    );
  }

  public async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  public async writeFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf-8');
  }

  public async readDocument(filePath: string) {
    return await readDocument(filePath);
  }

  public async saveDocument(filePath: string, data: any) {
    return await saveDocument(filePath, data);
  }

  public async createFile(filePath: string): Promise<boolean> {
    await fs.writeFile(filePath, '', 'utf-8');
    return true;
  }

  /**
   * 未命名のドキュメントを適切なフォルダ形式と名前で作成します。
   */
  public async createUntitledDocument(dirPath: string): Promise<string> {
    const dirType = this.getPreferredDocumentTypeForDirectory(dirPath);
    let baseName = '新規小説';
    let ext = '.txt';

    if (dirType === 'markdown') {
      baseName = '新規設定';
      ext = '.md';
    }

    const uniquePath = await this.getUniquePath(dirPath, baseName, ext);
    await fs.writeFile(uniquePath, '', 'utf-8');
    return uniquePath;
  }

  /**
   * 重複しないファイルパスを生成します。
   */
  private async getUniquePath(
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
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  }

  public async rename(oldPath: string, newPath: string): Promise<boolean> {
    await fs.rename(oldPath, newPath);
    return true;
  }

  public async move(oldPath: string, newPath: string): Promise<boolean> {
    await fs.rename(oldPath, newPath);
    return true;
  }

  public async copy(srcPath: string, destPath: string): Promise<boolean> {
    await fs.cp(srcPath, destPath, { recursive: true });
    return true;
  }

  public async delete(targetPath: string): Promise<boolean> {
    await fs.rm(targetPath, { recursive: true, force: true });
    return true;
  }
}
