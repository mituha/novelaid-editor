import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

export interface RecentProject {
  path: string;
  name: string;
  lastOpened: number;
}

const RECENT_PROJECTS_FILE = 'recent-projects.json';

function getFilePath() {
  return path.join(app.getPath('userData'), RECENT_PROJECTS_FILE);
}

export async function getRecentProjects(): Promise<RecentProject[]> {
  try {
    const filePath = getFilePath();
    const data = await fs.readFile(filePath, 'utf-8');
    const projects: RecentProject[] = JSON.parse(data);
    // 存在確認を行って、存在しないパスは除外する
    const validProjects: RecentProject[] = [];
    for (const project of projects) {
        try {
            await fs.access(project.path);
            validProjects.push(project);
        } catch {
            // ステイルなパスは無視
        }
    }
    return validProjects.sort((a, b) => b.lastOpened - a.lastOpened);
  } catch {
    return [];
  }
}

export async function addRecentProject(projectPath: string): Promise<void> {
  const projects = await getRecentProjects();
  const name = path.basename(projectPath);
  const now = Date.now();

  const existingIndex = projects.findIndex((p) => p.path === projectPath);
  if (existingIndex > -1) {
    projects[existingIndex].lastOpened = now;
  } else {
    projects.push({ path: projectPath, name, lastOpened: now });
  }

  // 最大10件程度に制限
  const limited = projects
    .sort((a, b) => b.lastOpened - a.lastOpened)
    .slice(0, 10);

  await fs.writeFile(getFilePath(), JSON.stringify(limited, null, 2), 'utf-8');
}

export async function removeRecentProject(projectPath: string): Promise<void> {
  const projects = await getRecentProjects();
  const filtered = projects.filter((p) => p.path !== projectPath);
  await fs.writeFile(getFilePath(), JSON.stringify(filtered, null, 2), 'utf-8');
}
