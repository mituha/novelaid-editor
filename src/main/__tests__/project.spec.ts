import path from 'path';
import fs from 'fs/promises';
import { loadProject, saveProject } from '../project';

// fsモジュールをモックする
jest.mock('fs/promises');

describe('project load logic', () => {
  const projectPath = '/test-project';
  const novelaidPath = path.join(projectPath, '.novelaid');
  const configPath = path.join(novelaidPath, 'config.json');
  const pluginsPath = path.join(novelaidPath, 'plugins');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return null if .novelaid directory does not exist', async () => {
    (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));

    const result = await loadProject(projectPath);
    expect(result).toBeNull();
  });

  it('should load config and plugins if .novelaid directory exists', async () => {
    // fs.accessのモック (成功)
    (fs.access as jest.Mock).mockResolvedValue(undefined);

    // config.jsonのモック
    const mockConfig = { theme: 'dark' };
    (fs.readFile as jest.Mock).mockImplementation((filePath) => {
      if (filePath === configPath) {
        return Promise.resolve(JSON.stringify(mockConfig));
      }
      if (filePath.endsWith('manifest.json')) {
        return Promise.resolve(
          JSON.stringify({
            id: 'test-plugin',
            name: 'Test Plugin',
            version: '1.0.0',
            main: 'index.js',
          }),
        );
      }
      return Promise.reject(new Error('ENOENT'));
    });

    // pluginsディレクトリのモック
    (fs.readdir as jest.Mock).mockImplementation((dirPath, options) => {
      if (dirPath === pluginsPath) {
        return Promise.resolve([
          { name: 'test-plugin', isDirectory: () => true } as any,
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await loadProject(projectPath);

    expect(result).not.toBeNull();
    expect(result?.config).toEqual(mockConfig);
    expect(result?.plugins).toHaveLength(1);
    expect(result?.plugins[0].id).toBe('test-plugin');
  });

  it('should handle missing config.json gracefully', async () => {
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as jest.Mock).mockRejectedValue(new Error('ENOENT'));
    (fs.readdir as jest.Mock).mockResolvedValue([]);

    const result = await loadProject(projectPath);

    expect(result).not.toBeNull();
    expect(result?.config).toEqual({});
    expect(result?.plugins).toEqual([]);
  });
});

describe('project save logic', () => {
  const projectPath = '/test-project';
  const novelaidPath = path.join(projectPath, '.novelaid');
  const configPath = path.join(novelaidPath, 'config.json');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should save config to config.json', async () => {
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

    const config = { theme: 'light' };
    await saveProject(projectPath, config);

    expect(fs.mkdir).toHaveBeenCalledWith(novelaidPath, { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledWith(
      configPath,
      JSON.stringify(config, null, 2),
      'utf-8',
    );
  });
});
