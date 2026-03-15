import path from 'path';
import { StorageService } from './storage/StorageService';

export interface RecentProject {
  path: string;
  name: string;
  lastOpened: number;
}

interface AppState {
  recentProjects?: RecentProject[];
}

const STATE_FILE = 'state';

export async function getRecentProjects(): Promise<RecentProject[]> {
  const storage = StorageService.getInstance();
  const state = await storage.loadGlobal<AppState>(STATE_FILE);
  const projects = state?.recentProjects || [];

  // 存在確認を行って、存在しないパスは除外する
  const validProjects: RecentProject[] = [];
  const fs = require('fs/promises'); // 補助的に使用
  for (const project of projects) {
    try {
      await fs.access(project.path);
      validProjects.push(project);
    } catch {
      // ステイルなパスは無視
    }
  }
  return validProjects.sort((a, b) => b.lastOpened - a.lastOpened);
}

export async function addRecentProject(projectPath: string): Promise<void> {
  const storage = StorageService.getInstance();
  const state = (await storage.loadGlobal<AppState>(STATE_FILE)) || {};
  const projects = state.recentProjects || [];
  const name = path.basename(projectPath);
  const now = Date.now();

  const existingIndex = projects.findIndex((p) => p.path === projectPath);
  if (existingIndex > -1) {
    projects[existingIndex].lastOpened = now;
  } else {
    projects.push({ path: projectPath, name, lastOpened: now });
  }

  // 最大10件程度に制限
  state.recentProjects = projects
    .sort((a, b) => b.lastOpened - a.lastOpened)
    .slice(0, 10);

  await storage.saveGlobal(STATE_FILE, state);
}

export async function removeRecentProject(projectPath: string): Promise<void> {
  const storage = StorageService.getInstance();
  const state = await storage.loadGlobal<AppState>(STATE_FILE);
  if (state?.recentProjects) {
    state.recentProjects = state.recentProjects.filter((p) => p.path !== projectPath);
    await storage.saveGlobal(STATE_FILE, state);
  }
}
