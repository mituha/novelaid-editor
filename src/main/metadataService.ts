import path from 'path';
import fs from 'fs/promises';
import { readDocument } from './metadata';

export interface MetadataEntry {
  path: string;
  name: string;
  metadata: Record<string, any>;
}

export class MetadataService {
  private index: Map<string, Record<string, any>> = new Map();
  private projectRoot: string | null = null;

  queryByPath(filePath: string): Record<string, any> | undefined {
    return this.index.get(filePath);
  }

  async scanProject(rootPath: string) {
    this.projectRoot = rootPath;
    this.index.clear();
    await this.scanDir(rootPath);
    console.log(`Metadata scan complete. Indexed ${this.index.size} files.`);
  }

  private async scanDir(dirPath: string) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Skip hidden directories and .novelaid
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        if (entry.isDirectory()) {
          await this.scanDir(fullPath);
        } else {
          // Check if it's a file we care about (md, txt, etc.)
          const ext = path.extname(fullPath).toLowerCase();
          if (['.md', '.markdown', '.txt'].includes(ext)) {
            await this.updateFileIndex(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to scan directory ${dirPath}:`, error);
    }
  }

  async updateFileIndex(filePath: string) {
    try {
      console.log(`[MetadataService] Updating index for ${filePath}`);
      const { metadata } = await readDocument(filePath);
      if (Object.keys(metadata).length > 0) {
        this.index.set(filePath, metadata);
        console.log(`[MetadataService] Indexed ${filePath} with tags: ${JSON.stringify(metadata.tags)}`);
      } else {
        this.index.delete(filePath);
        console.log(`[MetadataService] Removed ${filePath} from index (no metadata)`);
      }
    } catch (error) {
      console.error(`[MetadataService] Failed to index file ${filePath}:`, error);
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
      const fileTags = metadata.tags;
      if (!fileTags) continue;

      const fileTagArray = (Array.isArray(fileTags) ? fileTags : [fileTags])
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
