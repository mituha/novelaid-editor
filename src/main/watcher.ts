import chokidar from 'chokidar';
import { BrowserWindow } from 'electron';

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private currentPath: string | null = null;
  private mainWindow: BrowserWindow | null = null;

  constructor(window: BrowserWindow | null) {
    this.mainWindow = window;
  }

  setWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  start(projectPath: string) {
    if (this.currentPath === projectPath && this.watcher) {
      return;
    }

    this.stop();

    this.currentPath = projectPath;
    this.watcher = chokidar.watch(projectPath, {
      ignored: [
        /(^|[\/\\])\../, // ignore dotfiles
        '**/node_modules/**',
        '**/.git/**',
        '**/.novelaid/**', // ignore our metadata dir if needed
      ],
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher
      .on('add', (path) => this.sendEvent('add', path))
      .on('change', (path) => this.sendEvent('change', path))
      .on('unlink', (path) => this.sendEvent('unlink', path))
      .on('addDir', (path) => this.sendEvent('addDir', path))
      .on('unlinkDir', (path) => this.sendEvent('unlinkDir', path))
      .on('error', (error) => console.error(`Watcher error: ${error}`));

    console.log(`Started watching project at: ${projectPath}`);
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.currentPath = null;
  }

  private sendEvent(event: string, path: string) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('fs:file-changed', { event, path });
    }
  }
}
