import path from 'path';
import fs from 'fs/promises';
import { NovelaidDocumentType } from './models';

/**
 * ファイルシステム操作に関するサービス (novelaid-fs 汎用)
 * メインプロセスとレンダラープロセスの両方で使用されます。
 */
export class FileService {
  private static instance: FileService;
  private mainProcessProjectDirectory: string | null = null;
  private isRenderer: boolean;
  private attributeCache = new Map<string, { mtime: number; data: Map<string, string> }>();

  private constructor() {
    this.isRenderer = typeof window !== 'undefined' && (window as any).electron;
  }

  public static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
  }

  /** .novelaidattributes が変更されたとき、対象ディレクトリのキャッシュを破棄します (メインプロセス用) */
  public invalidateAttributeCache(dirPath: string) {
    if (!this.isRenderer) {
      this.attributeCache.delete(dirPath);
    }
  }

  /**
   * プロジェクトディレクトリを設定します。
   * レンダラープロセスから呼び出した場合は IPC 経由でメインプロセス側に設定されます。
   * メインプロセスから呼び出した場合は、クラスインスタンス内の変数に保持されます。
   */
  public async setProjectDirectory(path: string): Promise<void> {
    if (this.isRenderer) {
      await (window as any).electron.fs.setProjectDirectory(path);
    } else {
      this.mainProcessProjectDirectory = path;
    }
  }

  /**
   * 現在設定されているプロジェクトディレクトリを取得します。
   * レンダラープロセスから呼び出した場合は IPC 経由でメインプロセス側から取得します。
   * メインプロセスから呼び出した場合は、クラスインスタンス内の変数から取得します。
   */
  public async getProjectDirectory(): Promise<string | null> {
    if (this.isRenderer) {
      return await (window as any).electron.fs.getProjectDirectory();
    } else {
      return this.mainProcessProjectDirectory;
    }
  }

  /**
   * ファイルパスからドキュメントタイプを取得します。
   */
  public async getDocumentType(filePath: string): Promise<NovelaidDocumentType> {
    if (this.isRenderer) {
      return await (window as any).electron.fs.getDocumentType(filePath);
    }

    // メインプロセスでの実装
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.ch') return 'chat';
    if (ext === '.css') return 'css';
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext))
      return 'image';
    if (ext === '.txt') return 'novel';
    if (ext !== '.md' && ext !== '.markdown') return 'unknown';

    // mdファイルに対する特別な処理の確認
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
      if (matchedType) return matchedType as NovelaidDocumentType;
    }
    // 特殊処理を行わなかったマークダウンファイルはマークダウンです
    return 'markdown';
  }

  /**
   * ディレクトリパスから推奨されるドキュメントタイプを取得します。
   */
  public async getDirectoryType(dirPath: string): Promise<NovelaidDocumentType> {
    if (this.isRenderer) {
      return await (window as any).electron.fs.getDirectoryType(dirPath);
    }

    // メインプロセスでの実装
    const dirName = path.basename(dirPath).toLowerCase();

    // 1. 自分自身の .novelaidattributes `./` を確認
    const ownAttrs = await this.getAttributesForDirectory(dirPath);
    if (ownAttrs?.has('./')) {
      return ownAttrs.get('./')! as NovelaidDocumentType;
    }

    // 2. 親の .novelaidattributes `dirName/` を確認
    const parentPath = path.dirname(dirPath);
    if (parentPath !== dirPath && parentPath !== '.' && parentPath !== '/' && !parentPath.match(/^[a-zA-Z]:\\$/)) {
      const parentAttrs = await this.getAttributesForDirectory(parentPath);
      if (parentAttrs) {
        const dirKeyword = `${path.basename(dirPath)}/`;
        let matchedType: string | null = null;
        for (const [pattern, type] of parentAttrs.entries()) {
          // ディレクトリパターンの場合（/で終わる）
          if (pattern.endsWith('/') && this.patternMatches(pattern, dirKeyword)) {
            matchedType = type;
          }
        }
        if (matchedType) return matchedType as NovelaidDocumentType;
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
    if (parentPath !== dirPath && parentPath !== '.' && parentPath !== '/' && !parentPath.match(/^[a-zA-Z]:\\$/)) {
      return await this.getDirectoryType(parentPath);
    }

    // 5. デフォルト
    return 'novel';
  }

  /**
   * パターンが対象の文字列にマッチするか判定します。
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
   * .novelaidattributes を読み込み、パース結果を返します。(メインプロセス用)
   */
  private async getAttributesForDirectory(dirPath: string): Promise<Map<string, string> | null> {
    if (this.isRenderer) return null;

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
}
