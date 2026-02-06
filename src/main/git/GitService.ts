import simpleGit, { SimpleGit } from 'simple-git';
import { GitFileStatus, GitLogEntry } from './interface';

export class GitService {
  private static instance: GitService;

  private constructor() {}

  public static getInstance(): GitService {
    if (!GitService.instance) {
      GitService.instance = new GitService();
    }
    return GitService.instance;
  }

  private getGit(dir: string): SimpleGit {
    return simpleGit(dir);
  }

  async init(dir: string): Promise<void> {
    await this.getGit(dir).init();
  }

  async status(dir: string): Promise<GitFileStatus[]> {
    const status = await this.getGit(dir).status();
    return status.files.map((file) => ({
      path: file.path,
      index: file.index,
      working_dir: file.working_dir,
    }));
  }

  async log(dir: string): Promise<GitLogEntry[]> {
    try {
      const log = await this.getGit(dir).log();
      return log.all.map((entry) => ({
        hash: entry.hash,
        date: entry.date,
        message: entry.message,
        author_name: entry.author_name,
        author_email: entry.author_email,
      }));
    } catch (error) {
      // Return empty log if no commits yet (e.g. fresh init)
      return [];
    }
  }

  async add(dir: string, files: string[]): Promise<void> {
    await this.getGit(dir).add(files);
  }

  async commit(dir: string, message: string): Promise<void> {
    await this.getGit(dir).commit(message);
  }
}
