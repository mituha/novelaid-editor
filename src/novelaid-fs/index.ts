export * from "./models";

/**
 * メインプロセス側の状態保持用定数
 */
let mainProcessProjectDirectory: string | null = null;

/**
 * レンダラープロセスかどうかを判定します
 */
const isRenderer = typeof window !== 'undefined' && (window as any).electron;

/**
 * プロジェクトディレクトリを設定します。
 * レンダラープロセスから呼び出した場合は IPC 経由でメインプロセス側に設定されます。
 */
export async function setProjectDirectory(path: string): Promise<void> {
  if (isRenderer) {
    await (window as any).electron.fs.setProjectDirectory(path);
  } else {
    mainProcessProjectDirectory = path;
  }
}

/**
 * 現在設定されているプロジェクトディレクトリを取得します。
 * レンダラープロセスから呼び出した場合は IPC 経由でメインプロセス側から取得します。
 */
export async function getProjectDirectory(): Promise<string | null> {
  if (isRenderer) {
    return await (window as any).electron.fs.getProjectDirectory();
  } else {
    return mainProcessProjectDirectory;
  }
}
