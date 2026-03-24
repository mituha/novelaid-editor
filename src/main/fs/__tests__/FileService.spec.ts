import { FileService } from '../FileService';

describe('FileService project directory logic', () => {
  let fileService: FileService;

  beforeEach(async () => {
    fileService = FileService.getInstance();
    // シングルトンなので初期化
    await fileService.setProjectDirectory('');
  });

  it('should set and get project directory', async () => {
    const testPath = '/path/to/project';
    await fileService.setProjectDirectory(testPath);
    expect(await fileService.getProjectDirectory()).toBe(testPath);
  });

  it('should return empty string initially (after beforeEach)', async () => {
    expect(await fileService.getProjectDirectory()).toBe('');
  });

  it('should handle null', async () => {
    await fileService.setProjectDirectory(null as any);
    expect(await fileService.getProjectDirectory()).toBeNull();
  });
});
