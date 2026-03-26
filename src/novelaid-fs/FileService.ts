/**
 * ファイルシステム操作に関するサービス (novelaid-fs 汎用)
 * メインプロセスとレンダラープロセスの両方で使用されます。
 */
export class FileService {
  private static instance: FileService;
  private mainProcessProjectDirectory: string | null = null;
  private isRenderer: boolean;

  private constructor() {
    this.isRenderer = typeof window !== 'undefined' && (window as any).electron;
  }

  public static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
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
}
