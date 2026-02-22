export class FileService {
  private static instance: FileService;

  private constructor() {
  }

  public static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
  }

}
