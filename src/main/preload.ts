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
  | 'fs:delete'
  | 'project:load'
  | 'project:save-config'
  | 'ai:generate'
  | 'ai:stream'
  | 'ai:listModels'
  | 'ai:chat'
  | 'ai:streamChat' // Request channel for streaming
  | 'ai:streamChat:data' // Response channel for data
  | 'ai:streamChat:end' // Response channel for end
  | 'ai:streamChat:error' // Response channel for error
  | 'git:init'
  | 'git:status'
  | 'git:log'
  | 'git:add'
  | 'git:reset'
  | 'git:commit'
  | 'git:diff'
  | 'window:setTitle'
  | 'recent:get'
  | 'recent:add'
  | 'menu:go-home'
  | 'fs:file-changed'
  | 'metadata:query'
  | 'context-menu:show-file-explorer'
  | 'file-explorer:action';

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
    queryByTag(tag: string) {
      return ipcRenderer.invoke('metadata:query', tag);
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
