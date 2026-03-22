import { FileService } from '../FileService';

describe('FileService project directory logic', () => {
  let fileService: FileService;

  beforeEach(() => {
    fileService = FileService.getInstance();
    // シングルトンなので初期化
    fileService.setProjectDirectory('');
  });

  it('should set and get project directory', () => {
    const testPath = '/path/to/project';
    fileService.setProjectDirectory(testPath);
    expect(fileService.getProjectDirectory()).toBe(testPath);
  });

  it('should return empty string initially (after beforeEach)', () => {
    expect(fileService.getProjectDirectory()).toBe('');
  });

  it('should handle null', () => {
    fileService.setProjectDirectory(null as any);
    expect(fileService.getProjectDirectory()).toBeNull();
  });
});
