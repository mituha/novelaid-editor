import { NovelaidDocumentType, NovelaidDirEntry } from "./models";

/** レンダラープロセスかどうかを判定 */
const isRenderer = typeof window !== 'undefined' && (window as any).electron;

/**
 * プロジェクトディレクトリを設定します。
 * レンダラープロセスからのみ呼び出せます。
 */
export async function setProjectDirectory(path: string): Promise<void> {
  if (isRenderer) {
    return await (window as any).electron.fs.setProjectDirectory(path);
  }
  throw new Error("novelaid-fs: setProjectDirectory should be called from the renderer process. In the main process, use FileService directly.");
}

/**
 * プロジェクトディレクトリを取得します。
 * レンダラープロセスからのみ呼び出せます。
 */
export async function getProjectDirectory(): Promise<string | null> {
  if (isRenderer) {
    return await (window as any).electron.fs.getProjectDirectory();
  }
  throw new Error("novelaid-fs: getProjectDirectory should be called from the renderer process. In the main process, use FileService directly.");
}

/**
 * ファイルパスからドキュメントタイプを取得します。
 * レンダラープロセスからのみ呼び出せます。
 */
export async function getDocumentType(filePath: string): Promise<NovelaidDocumentType> {
  if (isRenderer) {
    return await (window as any).electron.fs.getDocumentType(filePath);
  }
  throw new Error("novelaid-fs: getDocumentType should be called from the renderer process. In the main process, use FileService directly.");
}

/**
 * ディレクトリパスから推奨されるドキュメントタイプを取得します。
 */
export async function getDirectoryType(dirPath: string): Promise<NovelaidDocumentType> {
  if (isRenderer) {
    return await (window as any).electron.fs.getDirectoryType(dirPath);
  }
  throw new Error("novelaid-fs: getDirectoryType should be called from the renderer process. In the main process, use FileService directly.");
}

/**
 * ディレクトリの中身を読み込み、エントリーのリストを返します。
 * レンダラープロセスからのみ呼び出せます。
 */
export async function readDirectory(
  dirPath: string,
  recursive: boolean = false,
  parentType?: NovelaidDocumentType,
): Promise<NovelaidDirEntry[]> {
  if (isRenderer) {
    return await (window as any).electron.fs.readDirectory(dirPath, recursive, parentType);
  }
  throw new Error("novelaid-fs: readDirectory should be called from the renderer process. In the main process, use FileService directly.");
}

export * from "./models";
