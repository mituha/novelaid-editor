import {
  app,
  Menu,
  shell,
  BrowserWindow,
  MenuItemConstructorOptions,
} from 'electron';

interface DarwinMenuItemConstructorOptions extends MenuItemConstructorOptions {
  selector?: string;
  submenu?: DarwinMenuItemConstructorOptions[] | Menu;
}

export default class MenuBuilder {
  mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  buildMenu(): Menu {
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
    ) {
      this.setupDevelopmentEnvironment();
    }

    const template =
      process.platform === 'darwin'
        ? this.buildDarwinTemplate()
        : this.buildDefaultTemplate();

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    return menu;
  }

  setupDevelopmentEnvironment(): void {
    this.mainWindow.webContents.on('context-menu', (_, props) => {
      const { x, y } = props;

      Menu.buildFromTemplate([
        {
          label: 'Inspect element',
          click: () => {
            this.mainWindow.webContents.inspectElement(x, y);
          },
        },
      ]).popup({ window: this.mainWindow });
    });
  }

  buildDarwinTemplate(): MenuItemConstructorOptions[] {
    const subMenuAbout: DarwinMenuItemConstructorOptions = {
      label: 'Electron',
      submenu: [
        {
          label: 'novelaid-editor について',
          selector: 'orderFrontStandardAboutPanel:',
        },
        { type: 'separator' },
        { label: 'サービス', submenu: [] },
        { type: 'separator' },
        {
          label: 'novelaid-editor を隠す',
          accelerator: 'Command+H',
          selector: 'hide:',
        },
        {
          label: '他を隠す',
          accelerator: 'Command+Shift+H',
          selector: 'hideOtherApplications:',
        },
        { label: 'すべて表示', selector: 'unhideAllApplications:' },
        { type: 'separator' },
        {
          label: '終了',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    };
    const subMenuEdit: DarwinMenuItemConstructorOptions = {
      label: '編集',
      submenu: [
        { label: '元に戻す', accelerator: 'Command+Z', selector: 'undo:' },
        { label: 'やり直し', accelerator: 'Shift+Command+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: '切り取り', accelerator: 'Command+X', selector: 'cut:' },
        { label: 'コピー', accelerator: 'Command+C', selector: 'copy:' },
        { label: '貼り付け', accelerator: 'Command+V', selector: 'paste:' },
        {
          label: 'すべて選択',
          accelerator: 'Command+A',
          selector: 'selectAll:',
        },
      ],
    };
    const subMenuViewDev: MenuItemConstructorOptions = {
      label: '表示',
      submenu: [
        {
          label: '再読み込み',
          accelerator: 'Command+R',
          click: () => {
            this.mainWindow.webContents.reload();
          },
        },
        {
          label: 'フルスクリーン切り替え',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
        {
          label: '開発者ツール',
          accelerator: 'Alt+Command+I',
          click: () => {
            this.mainWindow.webContents.toggleDevTools();
          },
        },
      ],
    };
    const subMenuViewProd: MenuItemConstructorOptions = {
      label: '表示',
      submenu: [
        {
          label: 'フルスクリーン切り替え',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
      ],
    };
    const subMenuWindow: DarwinMenuItemConstructorOptions = {
      label: 'ウィンドウ',
      submenu: [
        {
          label: '最小化',
          accelerator: 'Command+M',
          selector: 'performMiniaturize:',
        },
        { label: '閉じる', accelerator: 'Command+W', selector: 'performClose:' },
        { type: 'separator' },
        { label: 'すべてを手前に移動', selector: 'arrangeInFront:' },
      ],
    };
    const subMenuHelp: MenuItemConstructorOptions = {
      label: 'ヘルプ',
      submenu: [
        {
          label: '詳細',
          click() {
            shell.openExternal('https://github.com/mituha/novelaid-editor');
          },
        },
        {
          label: '不具合の報告・検索',
          click() {
            shell.openExternal('https://github.com/mituha/novelaid-editor/issues');
          },
        },
      ],
    };

    const subMenuView =
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
        ? subMenuViewDev
        : subMenuViewDev; // subMenuViewProd;
        // TODO:暫定的にexe版でも開発用メニュー表示

    return [subMenuAbout, subMenuEdit, subMenuView, subMenuWindow, subMenuHelp];
  }

  buildDefaultTemplate() {
    const templateDefault: MenuItemConstructorOptions[] = [
      {
        label: 'ファイル(&F)',
        submenu: [
          {
            label: '開く(&O)',
            accelerator: 'Ctrl+O',
          },
          {
            label: '閉じる(&C)',
            accelerator: 'Ctrl+W',
            click: () => {
              this.mainWindow.close();
            },
          },
          { type: 'separator' },
          {
            label: '書庫一覧(&L)',
            accelerator: 'Ctrl+Shift+L',
            click: () => {
              this.mainWindow.webContents.send('menu:go-home');
            },
          },
          {
            label: '設定(&S)',
            accelerator: 'Ctrl+,',
            click: () => {
              this.mainWindow.webContents.send('menu:open-settings');
            },
          },
        ],
      },
      {
        label: '表示(&V)',
        submenu:
          process.env.NODE_ENV === 'development' ||
          process.env.DEBUG_PROD === 'true'
            ? [
                {
                  label: '再読み込み(&R)',
                  accelerator: 'Ctrl+R',
                  click: () => {
                    this.mainWindow.webContents.reload();
                  },
                },
                {
                  label: 'フルスクリーン切り替え(&F)',
                  accelerator: 'F11',
                  click: () => {
                    this.mainWindow.setFullScreen(
                      !this.mainWindow.isFullScreen(),
                    );
                  },
                },
                {
                  label: '開発者ツール(&D)',
                  accelerator: 'Alt+Ctrl+I',
                  click: () => {
                    this.mainWindow.webContents.toggleDevTools();
                  },
                },
              ]
            : [
                {
                  label: 'フルスクリーン切り替え(&F)',
                  accelerator: 'F11',
                  click: () => {
                    this.mainWindow.setFullScreen(
                      !this.mainWindow.isFullScreen(),
                    );
                  },
                },
              ],
      },
      {
        label: 'ヘルプ',
        submenu: [
          {
            label: '詳細',
            click() {
              shell.openExternal('https://github.com/mituha/novelaid-editor');
            },
          },
          {
            label: '不具合の報告・検索',
            click() {
              shell.openExternal('https://github.com/mituha/novelaid-editor/issues');
            },
          },
        ],
      },
    ];

    return templateDefault;
  }
}
