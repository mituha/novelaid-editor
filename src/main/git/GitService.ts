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

  async clone(url: string, dir: string): Promise<void> {
    await simpleGit().clone(url, dir);
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
      // Define custom fields for type safety
      type CustomLogFields = {
        hash: string;
        date: string;
        message: string;
        refs: string;
        author_name: string;
        author_email: string;
        parents: string;
      };

      const log = await this.getGit(dir).log<CustomLogFields>({
        '--all': null,
        format: {
          hash: '%H',
          date: '%aI',
          message: '%s',
          refs: '%D',
          author_name: '%aN',
          author_email: '%aE',
          parents: '%P',
        },
      });

      return log.all.map((entry) => ({
        hash: entry.hash,
        date: entry.date,
        message: entry.message,
        author_name: entry.author_name,
        author_email: entry.author_email,
        refs: entry.refs,
        parents: entry.parents ? entry.parents.split(' ') : [],
      }));
    } catch (error) {
      // Return empty log if no commits yet (e.g. fresh init)
      return [];
    }
  }

  async add(dir: string, files: string[]): Promise<void> {
    await this.getGit(dir).add(files);
  }

  async reset(dir: string, files: string[]): Promise<void> {
    await this.getGit(dir).reset(['HEAD', ...files]);
  }

  async commit(dir: string, message: string): Promise<void> {
    await this.getGit(dir).commit(message);
  }

  async diff(dir: string, path: string, staged: boolean): Promise<string> {
    const git = this.getGit(dir);
    let diffText = '';

    if (staged) {
      diffText = await git.diff(['--staged', path]);
    } else {
      diffText = await git.diff([path]);

      // If diff is empty, check if it's an untracked file
      if (!diffText) {
        const status = await git.status([path]);
        if (status.files.length > 0 && status.files[0].working_dir === '?') {
          // It's an untracked file, read the whole content
          try {
            const fs = require('fs');
            const pathModule = require('path');
            const fullPath = pathModule.join(dir, path);
            const content = fs.readFileSync(fullPath, 'utf8');
            diffText = content
              .split(/\r?\n/)
              .map((line: string) => `+${line}`)
              .join('\n');
          } catch (e) {
            console.error('Failed to read untracked file', e);
          }
        }
      }
    }
    return diffText;
  }

  async getRemotes(dir: string): Promise<string[]> {
    const remotes = await this.getGit(dir).getRemotes();
    return remotes.map((r) => r.name);
  }

  async currentBranch(dir: string): Promise<string> {
    const status = await this.getGit(dir).status();
    return status.current || '';
  }

  async push(dir: string, remote: string, branch: string): Promise<void> {
    await this.getGit(dir).push(remote, branch);
  }
}
