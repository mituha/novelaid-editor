import fs from 'fs/promises';
import path from 'path';
import { dialog, BrowserWindow } from 'electron';
import { MetadataService } from '../metadataService';
import { readDocument, saveDocument, getLanguageForFile } from '../metadata';

export class FileService {
  private static instance: FileService;

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
            ? undefined
            : await getLanguageForFile(fullPath),
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
