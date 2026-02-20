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
      const { metadata } = await readDocument(filePath);
      if (Object.keys(metadata).length > 0) {
        this.index.set(filePath, metadata);
      } else {
        this.index.delete(filePath);
      }
    } catch (error) {
      console.error(`Failed to index file ${filePath}:`, error);
    }
  }

  removeFileFromIndex(filePath: string) {
    this.index.delete(filePath);
  }

  queryByTag(tagOrTags: string | string[]): MetadataEntry[] {
    const results: MetadataEntry[] = [];
    const targetTags = Array.isArray(tagOrTags) ? tagOrTags : [tagOrTags];

    for (const [filePath, metadata] of this.index.entries()) {
      const fileTags = metadata.tags;
      if (!fileTags) continue;

      const fileTagArray = Array.isArray(fileTags) ? fileTags : [fileTags];
      const match = targetTags.some((t) => fileTagArray.includes(t));

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
}
