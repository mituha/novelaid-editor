import path from 'path';
import fs from 'fs/promises';

export interface ProjectConfig {
  theme?: string;
  editor?: {
    fontSize?: number;
    [key: string]: any;
  };
  enabledPlugins?: string[];
  [key: string]: any;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  main: string;
  description?: string;
  [key: string]: any;
}

export interface LoadedProject {
  config: ProjectConfig;
  plugins: PluginManifest[];
}

const NOVELAGENT_DIR = '.novelagent';
const CONFIG_FILE = 'config.json';
const PLUGINS_DIR = 'plugins';
const MANIFEST_FILE = 'manifest.json';

/**
 * プロジェクトフォルダから設定とプラグイン情報を読み込みます。
 * @param projectPath プロジェクトのルートパス
 */
export async function loadProject(projectPath: string): Promise<LoadedProject | null> {
  const novelAgentPath = path.join(projectPath, NOVELAGENT_DIR);

  try {
    await fs.access(novelAgentPath);
  } catch {
    // .novelagentフォルダが存在しない場合は何もしない（あるいは初期化する？）
    // 現状はnullを返して「プロジェクトではない」または「設定なし」とする
    return null;
  }

  const config = await loadConfig(novelAgentPath);
  const plugins = await loadPlugins(novelAgentPath);

  return {
    config,
    plugins,
  };
}

async function loadConfig(novelAgentPath: string): Promise<ProjectConfig> {
  const configPath = path.join(novelAgentPath, CONFIG_FILE);
  try {
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.warn(`Failed to load config from ${configPath}:`, error);
    return {};
  }
}

async function loadPlugins(novelAgentPath: string): Promise<PluginManifest[]> {
  const pluginsPath = path.join(novelAgentPath, PLUGINS_DIR);
  const manifests: PluginManifest[] = [];

  try {
    const entries = await fs.readdir(pluginsPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestPath = path.join(pluginsPath, entry.name, MANIFEST_FILE);
        try {
          const data = await fs.readFile(manifestPath, 'utf-8');
          const manifest = JSON.parse(data);
          // IDがない場合はフォルダ名を使用するなどのフォールバックも考えられるが、一旦必須とする
          if (!manifest.id) {
            manifest.id = entry.name;
          }
          manifests.push(manifest);
        } catch (e) {
          // マニフェストがない、または不正なJSONの場合は無視
          console.warn(`Skipping plugin ${entry.name}:`, e);
        }
      }
    }
  } catch (error) {
    // pluginsフォルダがない場合などは空リストを返す
    if ((error as any).code !== 'ENOENT') {
      console.error(`Error reading plugins directory ${pluginsPath}:`, error);
    }
  }

  return manifests;
}
