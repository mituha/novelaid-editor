/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import fs from 'fs/promises';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { loadProject, saveProject } from './project';
import { readDocument, saveDocument } from './metadata';
import {
  getRecentProjects,
  addRecentProject,
  removeRecentProject,
} from './launcher';
import { ProviderFactory } from './ai/ProviderFactory';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (canceled) {
    return null;
  }
  return filePaths[0];
});

ipcMain.handle('dialog:confirm', async (_, message: string) => {
  if (!mainWindow) return false;
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Yes', 'No'],
    defaultId: 1,
    title: 'Confirm',
    message,
  });
  return response === 0;
});

ipcMain.handle('fs:readDirectory', async (_, dirPath: string) => {
  try {
    const dirents = await fs.readdir(dirPath, { withFileTypes: true });
    return dirents.map((dirent) => ({
      name: dirent.name,
      isDirectory: dirent.isDirectory(),
      path: path.join(dirPath, dirent.name),
    }));
  } catch (error) {
    console.error('Error reading directory:', error);
    throw error;
  }
});

ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  return await fs.readFile(filePath, 'utf-8');
});

ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
  return await fs.writeFile(filePath, content, 'utf-8');
});

ipcMain.handle('fs:readDocument', async (_, filePath: string) => {
  return await readDocument(filePath);
});

ipcMain.handle('fs:saveDocument', async (_, filePath: string, data: any) => {
  return await saveDocument(filePath, data);
});

ipcMain.handle('fs:createFile', async (_, filePath: string) => {
  try {
    await fs.writeFile(filePath, '', 'utf-8');
    return true;
  } catch (error) {
    console.error('Error creating file:', error);
    throw error;
  }
});

ipcMain.handle('fs:createDirectory', async (_, dirPath: string) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    console.error('Error creating directory:', error);
    throw error;
  }
});

ipcMain.handle('fs:rename', async (_, oldPath: string, newPath: string) => {
  try {
    await fs.rename(oldPath, newPath);
    return true;
  } catch (error) {
    console.error('Error renaming:', error);
    throw error;
  }
});

ipcMain.handle('fs:delete', async (_, targetPath: string) => {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
    return true;
  } catch (error) {
    console.error('Error deleting:', error);
    throw error;
  }
});

ipcMain.handle('project:load', async (_, projectPath: string) => {
  return await loadProject(projectPath);
});

ipcMain.handle(
  'project:save-config',
  async (_, projectPath: string, config: any) => {
    return await saveProject(projectPath, config);
  },
);

ipcMain.handle('recent:get', async () => {
  return await getRecentProjects();
});

ipcMain.handle('recent:add', async (_, projectPath: string) => {
  return await addRecentProject(projectPath);
});

ipcMain.handle('recent:remove', async (_, projectPath: string) => {
  return await removeRecentProject(projectPath);
});

ipcMain.handle('ai:generate', async (_, prompt: string, config: any) => {
  try {
    // Map ProjectConfig.ai structure to ProviderFactory.ProviderConfig
    const providerType = config.provider || 'lmstudio';
    let factoryConfig: any = {
        type: providerType,
        modelName: 'local-model' // Default
    };

    if (providerType === 'lmstudio') {
        factoryConfig.modelName = config.lmstudio?.model || 'local-model';
        factoryConfig.baseUrl = config.lmstudio?.baseUrl || 'ws://localhost:1234';
    } else if (providerType === 'gemini') {
        factoryConfig.modelName = config.gemini?.model || 'gemini-1.5-flash';
        factoryConfig.apiKey = config.gemini?.apiKey;
    } else if (providerType === 'openai') {
        factoryConfig.modelName = config.openai?.model || 'gpt-3.5-turbo';
        factoryConfig.baseUrl = config.openai?.baseUrl || 'http://localhost:1234/v1';
        factoryConfig.apiKey = config.openai?.apiKey;
    }

    const provider = ProviderFactory.createProvider(factoryConfig);
    return await provider.generateContent(prompt);
  } catch (error) {
    console.error('AI Generation Error:', error);
    throw error;
  }
});

ipcMain.handle('ai:stream', async (_, prompt: string, config: any) => {
    // Streaming over simple IPC handle is tricky because handle expects a Promise that resolves once.
    // Usually we use event.reply for streaming or specific stream IPC.
    // For now, I will implement it but the renderer needs to listen to a channel.
    // However, the interface asks for AsyncGenerator.
    // A common pattern for streaming in Electron is:
    // Renderer calls 'ai:stream-start' -> Main starts -> Main sends 'ai:stream-data' -> Main sends 'ai:stream-end'.

    // Changing approach: Return a unique ID (or just start) and assume renderer listens to a specific channel?
    // Or, keep it simple for now: 'ai:generate' is enough for basic usage.
    // If the user wants streaming, I'll add specific logic.
    // But the interface has streamContent.

    try {
        const provider = ProviderFactory.createProvider(config);
        // We can't return an async generator over IPC.
        // We need to consume it and send events.
        // But `handle` is request-response.
        // I will throw error for now as "Not Implemented for IPC" or leave it out until requested.
        throw new Error("Streaming not yet implemented over IPC");
    } catch (error) {
         console.error('AI Stream Error:', error);
        throw error;
    }
});

ipcMain.handle('ai:listModels', async (_, config: any) => {
  try {
    // Need to reconstruct config slightly as we did for generate
    const providerType = config.provider || 'lmstudio';
    let factoryConfig: any = {
        type: providerType,
        modelName: 'dummy' // Not used for listing but required by factory/constructor
    };

    if (providerType === 'lmstudio') {
        factoryConfig.baseUrl = config.lmstudio?.baseUrl || 'ws://localhost:1234';
    } else if (providerType === 'gemini') {
        factoryConfig.apiKey = config.gemini?.apiKey;
    } else if (providerType === 'openai') {
        factoryConfig.baseUrl = config.openai?.baseUrl || 'http://localhost:1234/v1';
        factoryConfig.apiKey = config.openai?.apiKey;
    }

    const provider = ProviderFactory.createProvider(factoryConfig);
    return await provider.listModels();
  } catch (error) {
    console.error('AI List Models Error:', error);
    // Return empty list on error
    return [];
  }
});

ipcMain.handle('ai:chat', async (_, messages: any[], config: any) => {
    try {
        const providerType = config.provider || 'lmstudio';
        let factoryConfig: any = {
            type: providerType,
            modelName: 'local-model'
        };

        if (providerType === 'lmstudio') {
            factoryConfig.modelName = config.lmstudio?.model || 'local-model';
            factoryConfig.baseUrl = config.lmstudio?.baseUrl || 'ws://localhost:1234';
        } else if (providerType === 'gemini') {
            factoryConfig.modelName = config.gemini?.model || 'gemini-1.5-flash';
            factoryConfig.apiKey = config.gemini?.apiKey;
        } else if (providerType === 'openai') {
            factoryConfig.modelName = config.openai?.model || 'gpt-3.5-turbo';
            factoryConfig.baseUrl = config.openai?.baseUrl || 'http://localhost:1234/v1';
            factoryConfig.apiKey = config.openai?.apiKey;
        }

        const provider = ProviderFactory.createProvider(factoryConfig);
        return await provider.chat(messages);
    } catch (error) {
        console.error('AI Chat Error:', error);
        throw error;
    }
});

ipcMain.handle('window:setTitle', (_, title: string) => {
  if (mainWindow) {
    mainWindow.setTitle(title);
  }
});

// Since we cannot directly stream over ipcMain.handle from a generator easily without protocol or push,
// we usually use webContents.send for streaming, OR we can just return the full text for now if streaming is too complex for this step.
// However, the previous `ai:stream` handler (if it existed) would have used reply.
// Let's implement a specific listener for streaming.
// NOTE: ipcMain.handle is for request-response.
// For streaming, we usually use ipcMain.on('ai:streamChat-start', ...) and send back 'ai:streamChat-data'.
// BUT, preload.ts defines `invoke`. `invoke` expects a promise result.
// If we want to stream, we might need a different pattern or use the existing `ai:stream` channel if it was set up for stream.
// Wait, I haven't implemented `ai:stream` handler logic fully either, just `ai:generate`.
// Let's stick to `ai:chat` (non-streaming) for the MVP of chat UI, or implement a simple streaming mechanism.
// Given strict TS/Electron constraints and time, I will add `ai:chat` first.
// If I want to support streaming, I should add `ai:streamChat` using `on` pattern in preload (which I have `on` and `sendMessage`).
// Let's add `on` handler for streaming.

ipcMain.on('ai:streamChat', async (event, messages: any[], config: any) => {
    try {
        const providerType = config.provider || 'lmstudio';
        let factoryConfig: any = {
            type: providerType,
            modelName: 'local-model'
        };

        if (providerType === 'lmstudio') {
            factoryConfig.modelName = config.lmstudio?.model || 'local-model';
            factoryConfig.baseUrl = config.lmstudio?.baseUrl || 'ws://localhost:1234';
        } else if (providerType === 'gemini') {
            factoryConfig.modelName = config.gemini?.model || 'gemini-1.5-flash';
            factoryConfig.apiKey = config.gemini?.apiKey;
        } else if (providerType === 'openai') {
            factoryConfig.modelName = config.openai?.model || 'gpt-3.5-turbo';
            factoryConfig.baseUrl = config.openai?.baseUrl || 'http://localhost:1234/v1';
            factoryConfig.apiKey = config.openai?.apiKey;
        }

        const provider = ProviderFactory.createProvider(factoryConfig);
        const stream = provider.streamChat(messages);

        for await (const chunk of stream) {
            event.reply('ai:streamChat:data', chunk);
        }
        event.reply('ai:streamChat:end');

    } catch (error) {
        console.error('AI Stream Chat Error:', error);
        event.reply('ai:streamChat:error', error instanceof Error ? error.message : String(error));
    }
});

import { GitService } from './git/GitService';

ipcMain.handle('git:init', async (_, dir: string) => {
  return await GitService.getInstance().init(dir);
});

ipcMain.handle('git:status', async (_, dir: string) => {
  return await GitService.getInstance().status(dir);
});

ipcMain.handle('git:log', async (_, dir: string) => {
  return await GitService.getInstance().log(dir);
});

ipcMain.handle('git:add', async (_, dir: string, files: string[]) => {
  return await GitService.getInstance().add(dir, files);
});

ipcMain.handle('git:reset', async (_, dir: string, files: string[]) => {
  return await GitService.getInstance().reset(dir, files);
});

ipcMain.handle('git:commit', async (_, dir: string, message: string) => {
  return await GitService.getInstance().commit(dir, message);
});

ipcMain.handle('git:diff', async (_, dir: string, path: string, staged: boolean) => {
  return await GitService.getInstance().diff(dir, path, staged);
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug').default();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
