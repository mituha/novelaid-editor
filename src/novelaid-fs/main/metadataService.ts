import path from 'path';
import fs from 'fs/promises';
import { readDocument } from './metadata';
import { toDocumentPath } from '../../common/utils/pathUtils';

export interface MetadataEntry {
  path: string;
  name: string;
  metadata: Record<string, any>;
}

export interface MetadataCacheEntry {
  mtime: number;
  metadata: Record<string, any>;
}

/**
 * プロジェクト内のドキュメントからメタデータを抽出・走査し、インデックスを構築・管理するサービス。
 * 非同期タスクキュー方式を採用し、バックグラウンドでメタデータスキャンを行います。
 */
export class MetadataService {
  private static instance: MetadataService;
  private index: Map<string, MetadataCacheEntry> = new Map();
  private projectRoot: string | null = null;
  private ignoreList: string[] = [];
  public onProgress: ((progress: number, currentDir?: string) => void) | null = null;

  // 非同期キュー用変数
  private queue: string[] = [];
  private isProcessing: boolean = false;
  private totalJobs: number = 0;
  private processedJobs: number = 0;
  private concurrency: number = 3; // 同時実行ワーカー数

  private constructor() {}

  public static getInstance(): MetadataService {
    if (!MetadataService.instance) {
      MetadataService.instance = new MetadataService();
    }
    return MetadataService.instance;
  }

  queryByPath(filePath: string): Record<string, any> | undefined {
    return this.index.get(filePath)?.metadata;
  }

  getCacheEntry(filePath: string): MetadataCacheEntry | undefined {
    return this.index.get(filePath);
  }

  /**
   * プロジェクトフォルダ全体をスキャンし、メタデータインデックスを再構築します。
   * ディレクトリスキャンを内部で走らせ、変更があったファイルのみをキューへ登録してバックグラウンドで解析します。
   */
  async scanProject(rootPath: string) {
    this.projectRoot = rootPath;
    this.index.clear();
    await this.loadIgnoreList(rootPath);
    this.totalJobs = 0;
    this.processedJobs = 0;
    this.queue = [];

    console.log(`Starting metadata scan for ${rootPath}...`);
    this.onProgress?.(0, 'Scanning directory structure...');

    try {
      // 循環参照を回避するため、動的インポートする
      const { FileService } = require('./FileService');
      // 再帰的ディレクトリスキャンを走らせることで、変更・未キャッシュファイルを自動キュー登録します
      await FileService.getInstance().readDirectory(rootPath, true);
    } catch (e) {
      console.error(`[MetadataService] Directory scan error:`, e);
      this.onProgress?.(100, 'Scan error');
    }
  }

  /**
   * 非同期スキャンキューにファイルパスを登録します。
   */
  public addToQueue(filePath: string) {
    if (this.queue.includes(filePath)) return;
    this.queue.push(filePath);
    this.totalJobs++;
    this.startProcessing();
  }

  /**
   * キューに登録されたタスクの非同期処理を開始します。
   */
  private async startProcessing() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    // 指定された並行度でワーカーを立ち上げる
    const workers = Array.from({ length: this.concurrency }, () => this.workerLoop());
    await Promise.all(workers);

    this.isProcessing = false;
  }

  /**
   * キューからタスクを取り出して処理するワーカーのループ処理。
   */
  private async workerLoop() {
    while (this.queue.length > 0) {
      const filePath = this.queue.shift();
      if (!filePath) break;

      try {
        await this.updateFileIndex(filePath);
      } catch (err) {
        console.error(`[MetadataService] Queue task failed for ${filePath}:`, err);
      }

      this.processedJobs++;
      
      // 進捗率を算出して通知
      if (this.totalJobs > 0) {
        const progress = Math.round((this.processedJobs / this.totalJobs) * 100);
        this.onProgress?.(progress, path.basename(filePath));
      }
    }

    // すべてのキュー処理が完了したらカウンタをリセット
    if (this.queue.length === 0 && this.processedJobs >= this.totalJobs) {
      this.onProgress?.(100, 'Scan complete');
      this.totalJobs = 0;
      this.processedJobs = 0;
    }
  }

  private async loadIgnoreList(rootPath: string) {
    this.ignoreList = [];
    try {
      const ignorePath = path.join(rootPath, '.novelaidignore');
      const content = await fs.readFile(ignorePath, 'utf8');
      this.ignoreList = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((p) => {
          let pattern = p;
          if (pattern.startsWith('/')) pattern = pattern.slice(1);
          if (pattern.startsWith('./')) pattern = pattern.slice(2);
          return pattern;
        });
      console.log(`Loaded ${this.ignoreList.length} ignore patterns.`);
    } catch (e) {
      // ファイルが存在しない場合は何もしない
    }
  }

  /**
   * 指定したファイルが無視対象に該当するかどうかを判定します。
   */
  public isIgnored(filePath: string): boolean {
    if (!this.projectRoot) return false;

    const absPath = path.resolve(filePath);
    const absRoot = path.resolve(this.projectRoot);

    if (!absPath.toLowerCase().startsWith(absRoot.toLowerCase())) {
      return true;
    }

    const relativePath = path
      .relative(absRoot, absPath)
      .replace(/\\/g, '/');

    if (relativePath.startsWith('.novelaid/')) return true;

    for (const pattern of this.ignoreList) {
      if (pattern.endsWith('/')) {
        const dirPattern = pattern.slice(0, -1);
        if (
          relativePath === dirPattern ||
          relativePath.startsWith(`${dirPattern}/`)
        ) {
          return true;
        }
      } else if (relativePath === pattern || path.basename(relativePath) === pattern) {
        return true;
      }
      if (pattern.includes('*')) {
        const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
        if (regex.test(relativePath) || regex.test(path.basename(relativePath))) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * ファイルインデックスを更新します。
   */
  async updateFileIndex(filePath: string) {
    if (this.isIgnored(filePath)) {
      console.log(`[MetadataService] Skipping ignored file during index update: ${filePath}`);
      return;
    }
    try {
      const stats = await fs.stat(filePath);
      const { metadata } = await readDocument(filePath);
      if (Object.keys(metadata).length > 0) {
        this.index.set(toDocumentPath(filePath), {
          mtime: stats.mtimeMs,
          metadata
        });
        console.log(`[MetadataService] Indexed: ${filePath} (Keys: ${Object.keys(metadata).join(', ')})`);
      } else {
        this.index.delete(toDocumentPath(filePath));
      }
    } catch (error) {
      console.error(`[MetadataService] Failed to index ${filePath}:`, error);
    }
  }

  /**
   * ファイルインデックスから指定されたファイルを削除します。
   */
  removeFileFromIndex(filePath: string) {
    console.log(`[MetadataService] Explicit removal of ${filePath}`);
    this.index.delete(toDocumentPath(filePath));
  }

  /**
   * タグでインデックスを検索します。
   */
  queryByTag(tagOrTags: string | string[]): MetadataEntry[] {
    const results: MetadataEntry[] = [];
    const targetTags = Array.isArray(tagOrTags) ? tagOrTags : [tagOrTags];
    const normalizedTargets = targetTags.map((t) => t.toLowerCase());

    for (const [filePath, entry] of this.index.entries()) {
      const metadata = entry.metadata;
      const fileTagsRaw = metadata.tags || metadata.tag;
      if (!fileTagsRaw) continue;

      const fileTagArray = (Array.isArray(fileTagsRaw) ? fileTagsRaw : [fileTagsRaw])
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.toLowerCase());

      const match = normalizedTargets.some((t) => fileTagArray.includes(t));

      if (match) {
        results.push({
          path: filePath,
          name: metadata.name || path.basename(filePath),
          metadata,
        });
      }
    }
    console.log(`[MetadataService] queryByTag(${targetTags.join(',')}) -> Found ${results.length} results`);
    return results;
  }

  /**
   * チャットが有効化されているドキュメント一覧を検索します。
   */
  queryChatEnabled(): MetadataEntry[] {
    const results: MetadataEntry[] = [];
    for (const [filePath, entry] of this.index.entries()) {
      const metadata = entry.metadata;
      if (metadata.chat?.enabled === true) {
        results.push({
          path: filePath,
          name: metadata.name || path.basename(filePath, path.extname(filePath)),
          metadata,
        });
      }
    }
    console.log(`[MetadataService] queryChatEnabled() -> Found ${results.length} results`);
    return results;
  }

  /**
   * ID、名前、またはファイル名からキャラクターを検索します。
   */
  async findCharacterById(id: string): Promise<MetadataEntry | null> {
    for (const [filePath, entry] of this.index.entries()) {
      const metadata = entry.metadata;
      if (metadata.id === id) {
        return { path: filePath, name: metadata.name || id, metadata };
      }
    }
    for (const [filePath, entry] of this.index.entries()) {
      const metadata = entry.metadata;
      if (metadata.name === id) {
        return { path: filePath, name: metadata.name, metadata };
      }
    }
    for (const [filePath, entry] of this.index.entries()) {
      const metadata = entry.metadata;
      if (path.basename(filePath, path.extname(filePath)) === id) {
        return { path: filePath, name: metadata.name || id, metadata };
      }
    }
    return null;
  }
}
