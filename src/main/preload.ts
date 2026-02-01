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
  | 'ai:streamChat:error'; // Response channel for error

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
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
