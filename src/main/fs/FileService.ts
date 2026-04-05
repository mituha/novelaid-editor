import fs from 'fs/promises';
import path from 'path';
import { dialog, BrowserWindow } from 'electron';
import { MetadataService } from '../metadataService';
import { readDocument, saveDocument } from '../metadata';
import { NovelaidDocumentType } from '../../novelaid-fs';
import { FileService as NovelaidFileService } from '../../novelaid-fs/FileService';
import { toDocumentPath } from '../../common/utils/pathUtils';

const LOG_PREFIX = '[FileService]';

export class FileService {
  private static instance: FileService;
  private beforeDeleteCallback: ((targetPath: string, reason: string) => void) | null = null;

  private constructor() {}

  public async setProjectDirectory(dirPath: string) {
    console.log(`${LOG_PREFIX} setProjectDirectory: ${dirPath}`);
    await NovelaidFileService.getInstance().setProjectDirectory(dirPath);
  }

  public async getProjectDirectory(): Promise<string | null> {
    return await NovelaidFileService.getInstance().getProjectDirectory();
  }

  public setBeforeDeleteCallback(callback: (targetPath: string, reason: string) => void) {
    this.beforeDeleteCallback = callback;
  }

  private validatePath(filePath: string) {
    if (filePath && filePath.includes('://')) {
      throw new Error(`Invalid file path: URI scheme detected in Main process: ${filePath}`);
    }
  }

  /** .novelaidattributes が変更されたとき、対象ディレクトリのキャッシュを破棄します */
  public invalidateAttributeCache(dirPath: string) {
    console.log(`${LOG_PREFIX} invalidateAttributeCache: ${dirPath}`);
    NovelaidFileService.getInstance().invalidateAttributeCache(dirPath);
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

  public async getDocumentType(filePath: string): Promise<NovelaidDocumentType> {
    this.validatePath(filePath);
    return await NovelaidFileService.getInstance().getDocumentType(filePath);
  }

  /**
   * ディレクトリ名から、そのディレクトリ内での優先ドキュメントタイプを推定します。
   */
  public async getPreferredDocumentTypeForDirectory(dirPath: string): Promise<NovelaidDocumentType> {
    // novelaid-fs 側の getDirectoryType を呼び出す
    return await NovelaidFileService.getInstance().getDirectoryType(dirPath);
  }

  public async readDirectory(
    dirPath: string,
    recursive: boolean = false,
    parentType?: NovelaidDocumentType,
  ) {
    this.validatePath(dirPath);
    console.log(`${LOG_PREFIX} readDirectory: ${dirPath} (recursive: ${recursive})`);
    return await NovelaidFileService.getInstance().readDirectory(
      dirPath,
      recursive,
      parentType,
    );
  }

  public async readFile(filePath: string): Promise<string> {
    this.validatePath(filePath);
    console.log(`${LOG_PREFIX} readFile: ${filePath}`);
    return await fs.readFile(filePath, 'utf-8');
  }

  public async writeFile(filePath: string, content: string): Promise<void> {
    this.validatePath(filePath);
    console.log(`${LOG_PREFIX} writeFile: ${filePath} (${content.length} 文字)`);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  public async readDocument(filePath: string) {
    this.validatePath(filePath);
    console.log(`${LOG_PREFIX} readDocument: ${filePath}`);
    return await readDocument(filePath);
  }

  public async saveDocument(filePath: string, data: any) {
    this.validatePath(filePath);
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
    return toDocumentPath(uniquePath);
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
    return toDocumentPath(filePath);
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
    // Renderer側でタブを閉じ、ファイルハンドルを解放させるための猶予を設ける
    await new Promise((resolve) => setTimeout(resolve, 100));
    await fs.rm(targetPath, { recursive: true, force: true });
    return true;
  }
}
