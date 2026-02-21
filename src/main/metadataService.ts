import path from 'path';
import fs from 'fs/promises';
import { readDocument } from './metadata';

export interface MetadataEntry {
  path: string;
  name: string;
  metadata: Record<string, any>;
}

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

  async scanProject(rootPath: string) {
    this.projectRoot = rootPath;
    this.index.clear();
    await this.loadIgnoreList(rootPath);

    console.log(`Starting metadata scan for ${rootPath}...`);
    this.onProgress?.(0, 'Scanning directory structure...');

    // 1. First Pass: Count total relevant files to estimate progress
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

    // 2. Second Pass: Actual scan
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
      // Ignore if file doesn't exist
    }
  }

  public isIgnored(filePath: string): boolean {
    if (!this.projectRoot) return false;

    // Use absolute paths and normalize them for comparison
    const absPath = path.resolve(filePath);
    const absRoot = path.resolve(this.projectRoot);

    // If file is not under project root, it's not "ignored" in the project sense,
    // but we shouldn't scan it either.
    if (!absPath.toLowerCase().startsWith(absRoot.toLowerCase())) {
      return true;
    }

    const relativePath = path
      .relative(absRoot, absPath)
      .replace(/\\/g, '/');

    // Skip .novelaid directory itself if not already handled
    if (relativePath.startsWith('.novelaid/')) return true;

    for (const pattern of this.ignoreList) {
      // Basic folder ignore: pattern/
      if (pattern.endsWith('/')) {
        const dirPattern = pattern.slice(0, -1);
        if (
          relativePath === dirPattern ||
          relativePath.startsWith(`${dirPattern}/`)
        ) {
          return true;
        }
      } else if (relativePath === pattern || path.basename(relativePath) === pattern) {
        // Exact match or filename match
        return true;
      }
      // Basic glob-like (very simple)
      if (pattern.includes('*')) {
        const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
        if (regex.test(relativePath) || regex.test(path.basename(relativePath))) {
          return true;
        }
      }
    }
    return false;
  }


  async updateFileIndex(filePath: string) {
    if (this.isIgnored(filePath)) {
      console.log(`[MetadataService] Skipping ignored file during index update: ${filePath}`);
      return;
    }
    try {
      const { metadata } = await readDocument(filePath);
      if (Object.keys(metadata).length > 0) {
        this.index.set(filePath, metadata);
        console.log(`[MetadataService] Indexed: ${filePath} (Keys: ${Object.keys(metadata).join(', ')})`);
      } else {
        this.index.delete(filePath);
      }
    } catch (error) {
      console.error(`[MetadataService] Failed to index ${filePath}:`, error);
    }
  }

  removeFileFromIndex(filePath: string) {
    console.log(`[MetadataService] Explicit removal of ${filePath}`);
    this.index.delete(filePath);
  }

  queryByTag(tagOrTags: string | string[]): MetadataEntry[] {
    const results: MetadataEntry[] = [];
    const targetTags = Array.isArray(tagOrTags) ? tagOrTags : [tagOrTags];
    const normalizedTargets = targetTags.map((t) => t.toLowerCase());

    for (const [filePath, metadata] of this.index.entries()) {
      // Support both 'tags' and 'tag' (singular)
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

  async findCharacterById(id: string): Promise<MetadataEntry | null> {
    // 1. Search by ID
    for (const [filePath, metadata] of this.index.entries()) {
      if (metadata.id === id) {
        return { path: filePath, name: metadata.name || id, metadata };
      }
    }
    // 2. Search by Name
    for (const [filePath, metadata] of this.index.entries()) {
      if (metadata.name === id) {
        return { path: filePath, name: metadata.name, metadata };
      }
    }
    // 3. Search by Filename
    for (const [filePath, metadata] of this.index.entries()) {
      if (path.basename(filePath, path.extname(filePath)) === id) {
        return { path: filePath, name: metadata.name || id, metadata };
      }
    }
    return null;
  }
}
