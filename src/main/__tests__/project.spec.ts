import path from 'path';
import fs from 'fs/promises';
import { loadProject } from '../project';

// fsモジュールをモックする
jest.mock('fs/promises');

describe('project load logic', () => {
  const projectPath = '/test-project';
  const novelAgentPath = path.join(projectPath, '.novelagent');
  const configPath = path.join(novelAgentPath, 'config.json');
  const pluginsPath = path.join(novelAgentPath, 'plugins');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return null if .novelagent directory does not exist', async () => {
    (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));

    const result = await loadProject(projectPath);
    expect(result).toBeNull();
  });

  it('should load config and plugins if .novelagent directory exists', async () => {
    // fs.accessのモック (成功)
    (fs.access as jest.Mock).mockResolvedValue(undefined);

    // config.jsonのモック
    const mockConfig = { theme: 'dark' };
    (fs.readFile as jest.Mock).mockImplementation((filePath) => {
      if (filePath === configPath) {
        return Promise.resolve(JSON.stringify(mockConfig));
      }
      if (filePath.endsWith('manifest.json')) {
         return Promise.resolve(JSON.stringify({ id: 'test-plugin', name: 'Test Plugin', version: '1.0.0', main: 'index.js' }));
      }
      return Promise.reject(new Error('ENOENT'));
    });

    // pluginsディレクトリのモック
    (fs.readdir as jest.Mock).mockImplementation((dirPath, options) => {
      if (dirPath === pluginsPath) {
        return Promise.resolve([
          { name: 'test-plugin', isDirectory: () => true } as any
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
