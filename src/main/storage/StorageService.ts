import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

/**
 * 設定や状態をJSONファイルとして保存・読み込みするためのサービス
 */
export class StorageService {
  private static instance: StorageService;

  private constructor() {}

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * アプリケーションレベル（グローバル）のデータを保存するディレクトリを取得
   */
  private getGlobalDir(): string {
    return app.getPath('userData');
  }

  /**
   * プロジェクトレベル（ローカル）のデータを保存するディレクトリを取得
   */
  private getLocalDir(projectPath: string): string {
    return path.join(projectPath, '.novelaid');
  }

  /**
   * グローバルな設定ファイルを読み込む
   */
  public async loadGlobal<T>(name: string): Promise<T | null> {
    const filePath = path.join(this.getGlobalDir(), `${name}.json`);
    return this.readJson<T>(filePath);
  }

  /**
   * グローバルな設定ファイルを保存する
   */
  public async saveGlobal<T>(name: string, data: T): Promise<void> {
    const dirPath = this.getGlobalDir();
    const filePath = path.join(dirPath, `${name}.json`);
    await this.writeJson(filePath, data);
  }

  /**
   * ローカル（プロジェクト内）の設定ファイルを読み込む
   */
  public async loadLocal<T>(projectPath: string, name: string): Promise<T | null> {
    const filePath = path.join(this.getLocalDir(projectPath), `${name}.json`);
    return this.readJson<T>(filePath);
  }

  /**
   * ローカル（プロジェクト内）の設定ファイルを保存する
   */
  public async saveLocal<T>(projectPath: string, name: string, data: T): Promise<void> {
    const dirPath = this.getLocalDir(projectPath);
    const filePath = path.join(dirPath, `${name}.json`);
    
    // .novelaidフォルダがない場合は作成
    await fs.mkdir(dirPath, { recursive: true });
    await this.writeJson(filePath, data);
  }

  private async readJson<T>(filePath: string): Promise<T | null> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null;
      }
      console.error(`Failed to read JSON from ${filePath}:`, error);
      throw error;
    }
  }

  private async writeJson<T>(filePath: string, data: T): Promise<void> {
    try {
      const json = JSON.stringify(data, null, 2);
      await fs.writeFile(filePath, json, 'utf-8');
    } catch (error) {
      console.error(`Failed to write JSON to ${filePath}:`, error);
      throw error;
    }
  }
}
