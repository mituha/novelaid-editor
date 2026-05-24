import path from 'path';
import fs from 'fs/promises';
import { readDocument } from './metadata';
import { toDocumentPath } from '../../common/utils/pathUtils';

export interface MetadataEntry {
  path: string;
  name: string;
  metadata: Record<string, any>;
}

/**
 * プロジェクト内のドキュメントからメタデータを抽出・走査し、インデックスを構築・管理するサービス。
 */
export class MetadataService {
  private static instance: MetadataService;
  private index: Map<string, Record<string, any>> = new Map();
  private projectRoot: string | null = null;
  private ignoreList: string[] = [];
  public onProgress: ((progress: number, currentDir?: string) => void) | null = null;

  private constructor() {}

  public static getInstance(): MetadataService {
    if (!MetadataService.instance) {
      MetadataService.instance = new MetadataService();
    }
    return MetadataService.instance;
  }

  queryByPath(filePath: string): Record<string, any> | undefined {
    return this.index.get(filePath);
  }

  /**
   * プロジェクトフォルダ全体をスキャンし、メタデータインデックスを再構築します。
   */
  async scanProject(rootPath: string) {
    this.projectRoot = rootPath;
    this.index.clear();
    await this.loadIgnoreList(rootPath);

    console.log(`Starting metadata scan for ${rootPath}...`);
    this.onProgress?.(0, 'Scanning directory structure...');

    // 1. 進捗見積もりのための事前カウント
    let totalFiles = 0;
    const countFiles = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || this.isIgnored(fullPath)) {
            continue;
          }

          if (entry.isDirectory()) {
            await countFiles(fullPath);
          } else {
            const ext = path.extname(fullPath).toLowerCase();
            if (['.md', '.markdown', '.txt'].includes(ext)) {
              totalFiles++;
            }
          }
        }
      } catch (e) {
        console.error(`[MetadataService] First pass count error in ${dir}:`, e);
      }
    };
    await countFiles(rootPath);
    console.log(`[MetadataService] Expected files to scan: ${totalFiles}`);

    // 2. 実際のファイルスキャン処理
    let processedFiles = 0;
    const scanDirWithProgress = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || this.isIgnored(fullPath)) continue;

          if (entry.isDirectory()) {
            await scanDirWithProgress(fullPath);
          } else {
            const ext = path.extname(fullPath).toLowerCase();
            if (['.md', '.markdown', '.txt'].includes(ext)) {
              await this.updateFileIndex(fullPath);
              processedFiles++;
              if (totalFiles > 0) {
                const progress = Math.round((processedFiles / totalFiles) * 100);
                this.onProgress?.(progress, entry.name);
              }
            }
          }
        }
      } catch (e) {
        console.error(`[MetadataService] Scan error in ${dir}:`, e);
      }
    };

    await scanDirWithProgress(rootPath);
    this.onProgress?.(100, 'Scan complete');
    console.log(`Metadata scan complete. Indexed ${this.index.size} files.`);
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
      const { metadata } = await readDocument(filePath);
      if (Object.keys(metadata).length > 0) {
        this.index.set(toDocumentPath(filePath), metadata);
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

    for (const [filePath, metadata] of this.index.entries()) {
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
    for (const [filePath, metadata] of this.index.entries()) {
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
    for (const [filePath, metadata] of this.index.entries()) {
      if (metadata.id === id) {
        return { path: filePath, name: metadata.name || id, metadata };
      }
    }
    for (const [filePath, metadata] of this.index.entries()) {
      if (metadata.name === id) {
        return { path: filePath, name: metadata.name, metadata };
      }
    }
    for (const [filePath, metadata] of this.index.entries()) {
      if (path.basename(filePath, path.extname(filePath)) === id) {
        return { path: filePath, name: metadata.name || id, metadata };
      }
    }
    return null;
  }
}
