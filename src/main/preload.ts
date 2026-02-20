// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels =
  | 'ipc-example'
  | 'dialog:openDirectory'
  | 'dialog:confirm'
  | 'fs:readDirectory'
  | 'fs:readFile'
  | 'fs:writeFile'
  | 'fs:createFile'
  | 'fs:createDirectory'
  | 'fs:rename'
  | 'fs:copy'
  | 'fs:move'
  | 'app:getVersion'
  | 'calibration:analyze';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    invoke(channel: Channels, ...args: unknown[]) {
      return ipcRenderer.invoke(channel, ...args);
    },
  },
  git: {
    init(dir: string) {
      return ipcRenderer.invoke('git:init', dir);
    },
    status(dir: string) {
      return ipcRenderer.invoke('git:status', dir);
    },
    log(dir: string) {
      return ipcRenderer.invoke('git:log', dir);
    },
    add(dir: string, files: string[]) {
      return ipcRenderer.invoke('git:add', dir, files);
    },
    reset(dir: string, files: string[]) {
      return ipcRenderer.invoke('git:reset', dir, files);
    },
    commit: (dir: string, message: string) =>
      ipcRenderer.invoke('git:commit', dir, message),
    diff: (dir: string, path: string, staged: boolean) =>
      ipcRenderer.invoke('git:diff', dir, path, staged),
    getRemotes: (dir: string) => ipcRenderer.invoke('git:getRemotes', dir),
    currentBranch: (dir: string) => ipcRenderer.invoke('git:currentBranch', dir),
    push: (dir: string, remote: string, branch: string) =>
      ipcRenderer.invoke('git:push', dir, remote, branch),
  },
  window: {
    setTitle(title: string) {
      return ipcRenderer.invoke('window:setTitle', title);
    },
  },
  fs: {
    onFileChange(func: (payload: any) => void) {
      const subscription = (_event: IpcRendererEvent, payload: any) =>
        func(payload);
      ipcRenderer.on('fs:file-changed', subscription);

      return () => {
        ipcRenderer.removeListener('fs:file-changed', subscription);
      };
    },
  },
  metadata: {
    queryByTag(tagOrTags: string | string[]) {
      return ipcRenderer.invoke('metadata:query', tagOrTags);
    },
  },
  app: {
    getVersion() {
      return ipcRenderer.invoke('app:getVersion');
    },
  },
  calibration: {
    analyze(text: string, settings: any) {
      return ipcRenderer.invoke('calibration:analyze', text, settings);
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
