import { GitFileStatus, GitLogEntry } from '../main/git/interface';
import { NovelaidDocumentType } from '../novelaid-fs/models';

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        sendMessage(channel: string, ...args: unknown[]): void;
        on(channel: string, func: (...args: unknown[]) => void): (() => void) | undefined;
        once(channel: string, func: (...args: unknown[]) => void): void;
        invoke(channel: string, ...args: unknown[]): Promise<any>;
      };
      git: {
        init(dir: string): Promise<void>;
        status(dir: string): Promise<GitFileStatus[]>;
        log(dir: string): Promise<GitLogEntry[]>;
        add(dir: string, files: string[]): Promise<void>;
        reset(dir: string, files: string[]): Promise<void>;
        commit(dir: string, message: string): Promise<void>;
        diff: (dir: string, path: string, staged: boolean) => Promise<string>;
        getRemotes(dir: string): Promise<string[]>;
        currentBranch(dir: string): Promise<string>;
        push(dir: string, remote: string, branch: string): Promise<void>;
      };
      window: {
        setTitle(title: string): Promise<void>;
        toggleFullScreen(): Promise<boolean>;
        isFullScreen(): Promise<boolean>;
      };
      fs: {
        onFileChange(func: (payload: any) => void): () => void;
        getDocumentType(filePath: string): Promise<NovelaidDocumentType>;
      };
      metadata: {
        queryByTag(tagOrTags: string | string[]): Promise<any[]>;
        queryChatEnabled(): Promise<any[]>;
      };
      app: {
        getVersion(): Promise<string>;
      };
      calibration: {
        analyze(text: string, settings?: any): Promise<{ frequency: any[]; issues: any[] }>;
        getKanjiRulesPath(): Promise<string>;
        reloadRules(): Promise<void>;
      };
      shell: {
        openExternal(url: string): Promise<void>;
      };
      path: {
        relative(from: string, to: string): Promise<string>;
        join(...paths: string[]): Promise<string>;
        resolve(...paths: string[]): Promise<string>;
        basename(p: string, ext?: string): Promise<string>;
        dirname(p: string): Promise<string>;
        extname(p: string): Promise<string>;
        normalize(p: string): Promise<string>;
        parse(p: string): Promise<{ root: string; dir: string; base: string; ext: string; name: string }>;
      };
    };
  }
}

export {};
