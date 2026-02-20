import chokidar from 'chokidar';
import { BrowserWindow } from 'electron';

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private currentPath: string | null = null;
  private mainWindow: BrowserWindow | null = null;

  private listeners: ((event: string, path: string) => void)[] = [];

  constructor(window: BrowserWindow | null) {
    this.mainWindow = window;
  }

  setWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  onFileEvent(callback: (event: string, path: string) => void) {
    this.listeners.push(callback);
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
      .on('add', (path) => this.handleEvent('add', path))
      .on('change', (path) => this.handleEvent('change', path))
      .on('unlink', (path) => this.handleEvent('unlink', path))
      .on('addDir', (path) => this.handleEvent('addDir', path))
      .on('unlinkDir', (path) => this.handleEvent('unlinkDir', path))
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

  private handleEvent(event: string, path: string) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('fs:file-changed', { event, path });
    }
    this.listeners.forEach((listener) => listener(event, path));
  }
}
