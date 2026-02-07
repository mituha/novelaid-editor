import { GitFileStatus, GitLogEntry } from '../main/git/interface';

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
        commit(dir: string, message: string): Promise<void>;
      };
      window: {
        setTitle(title: string): Promise<void>;
      };
    };
  }
}

export {};
