import chokidar from 'chokidar';
import { BrowserWindow } from 'electron';
import { MetadataService } from './metadataService';

const LOG_PREFIX = '[FileWatcher]';

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private currentPath: string | null = null;
  private mainWindow: BrowserWindow | null = null;

  private listeners: ((event: string, path: string) => void)[] = [];
  private ignoreCheck: ((path: string) => boolean) | null = null;

  constructor(window: BrowserWindow | null) {
    this.mainWindow = window;
  }

  setWindow(window: BrowserWindow) {
    console.log(`${LOG_PREFIX} setWindow`);
    this.mainWindow = window;
  }

  onFileEvent(callback: (event: string, path: string) => Promise<void> | void) {
    console.log(`${LOG_PREFIX} onFileEvent: リスナーを登録 (合計 ${this.listeners.length + 1} 件)`);
    this.listeners.push(callback);
  }

  setIgnoreCheck(check: (path: string) => boolean) {
    console.log(`${LOG_PREFIX} setIgnoreCheck: ignoreチェック関数を設定`);
    this.ignoreCheck = check;
  }

  start(projectPath: string) {
    if (this.currentPath === projectPath && this.watcher) {
      console.log(`${LOG_PREFIX} start: すでに監視中のためスキップ: ${projectPath}`);
      return;
    }

    this.stop();

    this.currentPath = projectPath;
    this.watcher = chokidar.watch(projectPath, {
      ignored: [
        (filePath: string) => {
          const base = filePath.split(/[/\\]/).pop() ?? '';
          // .novelaidattributes は監視対象とする（dotfile 除外の例外）
          if (base === '.novelaidattributes') return false;
          // その他の dotfile および特定ディレクトリは除外
          if (base.startsWith('.')) return true;
          if (filePath.includes('node_modules')) return true;
          return false;
        },
      ],
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher
      .on('add', (filePath: string) => this.handleEvent('add', filePath))
      .on('change', (filePath: string) => this.handleEvent('change', filePath))
      .on('unlink', (filePath: string) => this.handleEvent('unlink', filePath))
      .on('addDir', (filePath: string) => this.handleEvent('addDir', filePath))
      .on('unlinkDir', (filePath: string) => this.handleEvent('unlinkDir', filePath))
      .on('error', (error) => console.error(`${LOG_PREFIX} エラー: ${error}`));

    console.log(`${LOG_PREFIX} start: 監視開始: ${projectPath}`);
  }

  stop() {
    if (this.watcher) {
      console.log(`${LOG_PREFIX} stop: 監視停止: ${this.currentPath}`);
      this.watcher.close();
      this.watcher = null;
    }
    this.currentPath = null;
  }

  private async handleEvent(event: string, filePath: string) {
    // Skip if ignored by .novelaidignore via callback
    if (this.ignoreCheck && this.ignoreCheck(filePath)) {
      console.log(`${LOG_PREFIX} handleEvent: ignoreスキップ [${event}] ${filePath}`);
      return;
    }

    console.log(`${LOG_PREFIX} handleEvent: [${event}] ${filePath}`);

    // 1. Wait for all internal (main process) listeners to finish updating their state
    await Promise.all(this.listeners.map((listener) => listener(event, filePath)));

    // 2. Only then notify the renderer process that it's safe to reload data
    if (this.mainWindow) {
      console.log(`${LOG_PREFIX} handleEvent: レンダラーに通知 [${event}] ${filePath}`);
      this.mainWindow.webContents.send('fs:file-changed', { event, path: filePath });
    }
  }
}
