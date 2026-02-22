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
import { app, BrowserWindow, shell, ipcMain, dialog, Menu, protocol, net, session } from 'electron';

import { pathToFileURL } from 'url';
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
import { GitService } from './git/GitService';
import { FileWatcher } from './watcher';
import { MetadataService } from './metadataService';
import { CalibrationService } from './calibration/CalibrationService';
import { AIService } from './ai/AIService';
import { FileService } from './fs/FileService';




protocol.registerSchemesAsPrivileged([
  {
    scheme: 'nvfs',
    privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true, allowServiceWorkers: true },
  },
  {
    scheme: 'app-asset',
    privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true },
  },
]);





class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;

    // 1. エラーイベントを登録するわん（呼び出しより先に書くのがコツだわん！）
    autoUpdater.on('error', (err) => {
      log.error('Updaterでエラーが発生したけど、無視して続行するわん:', err);
    });

    // 2. アップデートをチェック。エラーが起きても catch で受け止めるわん
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      log.error('アップデートの確認中にエラーが発生したわん:', err.message || err);
    });
  }
}

let mainWindow: BrowserWindow | null = null;
const fileWatcher = new FileWatcher(null);
const metadataService = MetadataService.getInstance();
fileWatcher.setIgnoreCheck((filePath) => metadataService.isIgnored(filePath));
let activeProjectPath: string | null = null; // Added

// Direct metadata update in main process
fileWatcher.onFileEvent(async (event, filePath) => {
  // .novelaidattributes が変更された場合、属性キャッシュを破棄する
  if (path.basename(filePath) === '.novelaidattributes') {
    FileService.getInstance().invalidateAttributeCache(path.dirname(filePath));
    return; // メタデータ更新は不要
  }

  if (event === 'add' || event === 'change') {
    await metadataService.updateFileIndex(filePath);
  } else if (event === 'unlink') {
    metadataService.removeFileFromIndex(filePath);
  }
});

FileService.getInstance().setBeforeDeleteCallback((targetPath) => {
  if (mainWindow) {
    mainWindow.webContents.send('app:close-file', targetPath);
  }
});

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});





ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) return null;
  return await FileService.getInstance().openDirectory(mainWindow);
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
    return await FileService.getInstance().readDirectory(dirPath);
  } catch (error) {
    console.error('Error reading directory:', error);
    throw error;
  }
});

ipcMain.handle('fs:getDirectoryType', async (_, dirPath: string) => {
  return FileService.getInstance().getPreferredDocumentTypeForDirectory(dirPath);
});

ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  return await FileService.getInstance().readFile(filePath);
});

ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
  return await FileService.getInstance().writeFile(filePath, content);
});

ipcMain.handle('fs:readDocument', async (_, filePath: string) => {
  return await FileService.getInstance().readDocument(filePath);
});

ipcMain.handle('fs:saveDocument', async (_, filePath: string, data: any) => {
  return await FileService.getInstance().saveDocument(filePath, data);
});

ipcMain.handle('metadata:query', async (_, tagOrTags: string | string[]) => {
  return metadataService.queryByTag(tagOrTags);
});

ipcMain.handle('fs:createFile', async (_, filePath: string) => {
  try {
    return await FileService.getInstance().createFile(filePath);
  } catch (error) {
    console.error('Error creating file:', error);
    throw error;
  }
});

ipcMain.handle('fs:createUntitledDocument', async (_, dirPath: string) => {
  try {
    return await FileService.getInstance().createUntitledDocument(dirPath);
  } catch (error) {
    console.error('Error creating untitled document:', error);
    throw error;
  }
});

ipcMain.handle('fs:createDirectory', async (_, dirPath: string) => {
  try {
    return await FileService.getInstance().createDirectory(dirPath);
  } catch (error) {
    console.error('Error creating directory:', error);
    throw error;
  }
});

ipcMain.handle('fs:rename', async (_, oldPath: string, newPath: string) => {
  try {
    return await FileService.getInstance().rename(oldPath, newPath);
  } catch (error) {
    console.error('Error renaming:', error);
    throw error;
  }
});

ipcMain.handle('fs:move', async (_, oldPath: string, newPath: string) => {
  try {
    return await FileService.getInstance().move(oldPath, newPath);
  } catch (error) {
    console.error('Error moving:', error);
    throw error;
  }
});


ipcMain.handle('fs:copy', async (_, srcPath: string, destPath: string) => {
  try {
    return await FileService.getInstance().copy(srcPath, destPath);
  } catch (error) {
    console.error('Error copying:', error);
    throw error;
  }
});

ipcMain.handle(
  'context-menu:show-file-explorer',
  async (event, isDirectory: boolean, filePath: string) => {
    const template: any[] = [
      {
        label: 'エクスプローラーで表示',
        click: () => {
          shell.showItemInFolder(filePath);
        },
      },
      { type: 'separator' },
      {
        label: '名前を変更',
        click: () => {
          event.sender.send('file-explorer:action', 'rename');
        },
      },
      { type: 'separator' },
      {
        label: '削除',
        click: () => {
          event.sender.send('file-explorer:action', 'delete');
        },
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    menu.popup({
      window: BrowserWindow.fromWebContents(event.sender) || undefined,
    });
    return true;
  },
);

ipcMain.handle('fs:delete', async (_, targetPath: string) => {
  try {
    return await FileService.getInstance().delete(targetPath);
  } catch (error) {
    console.error('Error deleting:', error);
    throw error;
  }
});

ipcMain.handle('project:load', async (_, projectPath: string) => {
  activeProjectPath = projectPath;
  const project = await loadProject(projectPath);

  // Always start watcher and scan, regardless of whether it's a formal project
  fileWatcher.start(projectPath);

  // Non-blocking scan with progress reporting
  metadataService.onProgress = (progress, status) => {
    if (mainWindow) {
      mainWindow.webContents.send('metadata:scan-progress', { progress, status });
    }
  };
  metadataService.scanProject(projectPath); // No await
  await CalibrationService.getInstance().loadCustomRules(projectPath);

  return project;
});

ipcMain.handle(
  'project:save-config',
  async (_, projectPath: string, config: any) => {
    return await saveProject(projectPath, config);
  },
);

ipcMain.handle(
  'project:create',
  async (_, { parentDir, name, cloneUrl }: { parentDir: string; name: string; cloneUrl?: string }) => {
    const targetPath = path.join(parentDir, name);

    if (cloneUrl) {
      await GitService.getInstance().clone(cloneUrl, targetPath);
    } else {
      await fs.mkdir(targetPath, { recursive: true });
      await GitService.getInstance().init(targetPath);
    }

    return targetPath;
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
  return AIService.getInstance().generate(prompt, config);
});

ipcMain.handle('ai:stream', async (_, prompt: string, config: any) => {
  throw new Error('Streaming not yet implemented over IPC handle');
});

ipcMain.handle('ai:listModels', async (_, config: any) => {
  return AIService.getInstance().listModels(config);
});

ipcMain.handle('ai:chat', async (_, messages: any[], config: any) => {
  return AIService.getInstance().chat(messages, config);
});

ipcMain.handle('window:setTitle', (_, title: string) => {
  if (mainWindow) {
    mainWindow.setTitle(title);
  }
});

ipcMain.handle('window:toggleFullScreen', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
    return mainWindow.isFullScreen();
  }
  return false;
});

ipcMain.handle('window:isFullScreen', () => {
  return mainWindow ? mainWindow.isFullScreen() : false;
});

ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('shell:openExternal', async (_, url: string) => {
  return await shell.openExternal(url);
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

ipcMain.handle('metadata:queryChatEnabled', async () => {
    return metadataService.queryChatEnabled();
});

ipcMain.on(
  'ai:streamChat',
  async (event, messages: any[], config: any, personaId?: string, roleId?: string) => {
    AIService.getInstance().streamChat(event, messages, config, personaId, roleId);
  },
);



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

ipcMain.handle('git:getRemotes', async (_, dir: string) => {
  return await GitService.getInstance().getRemotes(dir);
});

ipcMain.handle('git:currentBranch', async (_, dir: string) => {
  return await GitService.getInstance().currentBranch(dir);
});

ipcMain.handle('git:push', async (_, dir: string, remote: string, branch: string) => {
  return await GitService.getInstance().push(dir, remote, branch);
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
    // NOTE: Extension loading is disabled here because it was causing "Could not establish connection"
    // errors and application crashes in some environments.
    // await installExtensions();
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
      webviewTag: true,
    },
  });

  fileWatcher.setWindow(mainWindow);

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
  if (!isDebug) {
    new AppUpdater();
  }

  // Initialize Calibration Service
  // Note: Kuromoji dictionary path needs to be resolved correctly in prod vs dev
  const isProd = app.isPackaged;
  // In dev, node_modules/kuromoji/dict
  // In prod, resources/dict (we need to copy it there)
  const dictPath = isProd
    ? path.join(process.resourcesPath, 'dict')
    : path.resolve(__dirname, '../../node_modules/kuromoji/dict');

  CalibrationService.getInstance().initialize(dictPath).catch(err => {
      console.error('Failed to initialize calibration service:', err);
  });
};

ipcMain.handle('calibration:analyze', async (_, text: string, settings: any) => {
    try {
        const service = CalibrationService.getInstance();
        const frequency = await service.getFrequentWords(text);

        // Use textlint for particle checks if enabled, internal check is removed
        const consistencyIssues = await service.checkConsistency(text, settings?.kanjiOpenClose);
        const textlintIssues = await service.runTextlint(text, settings);

        const allIssues = [...consistencyIssues, ...textlintIssues];
        console.log(`[IPC] calibration:analyze - Derived ${allIssues.length} total issues (textlint: ${textlintIssues.length})`);

        return {
            frequency,
            issues: allIssues
        };
    } catch (error) {
        console.error('Calibration error:', error);
        throw error;
    }
});

ipcMain.handle(
  'search:project',
  async (_, query: string, rootPath: string, options?: { caseSensitive?: boolean }) => {
    const targetPath = rootPath || activeProjectPath;
    if (!query || !targetPath) return [];

    const results: { filePath: string; matches: any[]; lineOffset: number }[] = [];
    const ignoreDirs = new Set(['node_modules', 'dist', 'out', 'build', '.git', '.erb', '.idea', '.vscode']);
    const textExtensions = new Set([
      '.md', '.txt', '.json', '.js', '.ts', '.tsx', '.jsx', '.css', '.html', '.yml', '.yaml', '.xml'
    ]);

    const searchRecursively = async (dir: string) => {
      try {
        const dirents = await fs.readdir(dir, { withFileTypes: true });

        for (const dirent of dirents) {
          const resPath = path.join(dir, dirent.name);

          if (dirent.isDirectory()) {
            if (dirent.name.startsWith('.') || dirent.name === 'node_modules')
              continue;
            if (metadataService.isIgnored(resPath))
              continue;
            await searchRecursively(resPath);
          } else if (dirent.isFile()) {
            if (metadataService.isIgnored(resPath))
              continue;
            const ext = path.extname(dirent.name).toLowerCase();
             if (textExtensions.has(ext)) {
               try {
                 const { content } = await readDocument(resPath);
                 const matches: any[] = [];
                 const lines = content.split('\n');

                 for (let i = 0; i < lines.length; i++) {
                   const line = lines[i];
                   let matchIndex = -1;

                   if (options?.caseSensitive) {
                      matchIndex = line.indexOf(query);
                   } else {
                      matchIndex = line.toLowerCase().indexOf(query.toLowerCase());
                   }

                   if (matchIndex !== -1) {
                     // Simple match finding (first match per line for now)
                     // Truncate line if too long?
                     const displayLine = line.length > 200 ? line.substring(0, 200) + '...' : line;
                     matches.push({
                       line: i + 1, // Relative to content start check
                       text: displayLine.trim(),
                       index: matchIndex
                     });
                   }
                 }

                 if (matches.length > 0) {
                   results.push({ filePath: resPath, matches, lineOffset: 0 });
                 }

               } catch (err) {
                 // Ignore read errors
               }
            }
          }
        }
      } catch (err) {
        console.error(`Error searching in ${dir}:`, err);
      }
    };

    await searchRecursively(targetPath);
    return results;
  }
);

ipcMain.handle('calibration:getKanjiRulesPath', async () => {
    if (!activeProjectPath) throw new Error('No active project');
    return await CalibrationService.getInstance().createDefaultRulesFile(activeProjectPath);
});

ipcMain.handle('calibration:reloadRules', async () => {
    if (!activeProjectPath) return;
    await CalibrationService.getInstance().loadCustomRules(activeProjectPath);
});

ipcMain.on('app:open-file', (event, filePath: string) => {
    event.sender.send('app:open-file', filePath);
});

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
    log.info('Main: app.whenReady() triggered');




// Register custom protocols
    const RESOURCES_PATH = app.isPackaged
      ? path.join(process.resourcesPath, 'assets')
      : path.join(__dirname, '../../assets');

    const nvfsHandler = async (request: Request) => {
      try {
        const url = new URL(request.url);
        // nvfs://local/D:/path -> pathname is /D:/path
        let filePath = decodeURIComponent(url.pathname);
        if (process.platform === 'win32' && filePath.startsWith('/')) {
          filePath = filePath.slice(1);
        }

        return net.fetch(pathToFileURL(filePath).toString());

      } catch (e) {
        return new Response('Not Found', { status: 404 });
      }
    };

    session.defaultSession.protocol.handle('nvfs', nvfsHandler);

    protocol.handle('app-asset', (request) => {
      try {

        const url = request.url.replace(/^app-asset:\/\/+/, '');
        const filePath = path.join(RESOURCES_PATH, path.normalize(url));
        console.error(`[PROTOCOL] app-asset: ${filePath}`);
        return net.fetch(pathToFileURL(filePath).toString());
      } catch (e) {
        console.error(`[PROTOCOL_ERR] app-asset failure:`, e);
        return new Response('Not Found', { status: 404 });
      }
    });

    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
