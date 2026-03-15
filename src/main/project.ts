import path from 'path';
import fs from 'fs/promises';
import { StorageService } from './storage/StorageService';

export interface ProjectConfig {
  theme?: string;
  editor?: {
    fontSize?: number;
    showLineNumbers?: boolean;
    showMinimap?: boolean;
    wordWrap?: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
    [key: string]: any;
  };
  ai?: {
    provider?: 'lmstudio' | 'gemini' | 'openai';
    lmstudio?: {
       model?: string;
       baseUrl?: string;
    };
    gemini?: {
       apiKey?: string;
       model?: string;
    };
    openai?: {
        apiKey?: string;
        baseUrl?: string;
        model?: string;
    };
  };
  metadataLists?: {
    id: string;
    title: string;
    tag: string;
  }[];
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

const NOVELAID_DIR = '.novelaid';
const CONFIG_FILE = 'config'; // .json は StorageService が付与
const PLUGINS_DIR = 'plugins';
const MANIFEST_FILE = 'manifest.json';

/**
 * プロジェクトフォルダから設定とプラグイン情報を読み込みます。
 * @param projectPath プロジェクトのルートパス
 */
export async function loadProject(
  projectPath: string,
): Promise<LoadedProject | null> {
  const novelaidPath = path.join(projectPath, NOVELAID_DIR);

  try {
    await fs.access(novelaidPath);
  } catch {
    // .novelaidフォルダが存在しない場合は空の設定を返すか、nullにするか。
    // StorageService.loadLocal が内部で存在確認するため、そちらに任せることも可能。
    // ここでは以前の挙動を維持しつつ、StorageService を使う。
  }

  const storage = StorageService.getInstance();
  const config = (await storage.loadLocal<ProjectConfig>(projectPath, CONFIG_FILE)) || {};
  const plugins = await loadPlugins(novelaidPath);

  return {
    config,
    plugins,
  };
}

async function loadPlugins(novelaidPath: string): Promise<PluginManifest[]> {
  const pluginsPath = path.join(novelaidPath, PLUGINS_DIR);
  // ... (loadPlugins の実装は変更なし)
  const manifests: PluginManifest[] = [];

  try {
    const entries = await fs.readdir(pluginsPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestPath = path.join(pluginsPath, entry.name, MANIFEST_FILE);
        try {
          const data = await fs.readFile(manifestPath, 'utf-8');
          const manifest = JSON.parse(data);
          if (!manifest.id) {
            manifest.id = entry.name;
          }
          manifests.push(manifest);
        } catch (e) {
          console.warn(`Skipping plugin ${entry.name}:`, e);
        }
      }
    }
  } catch (error) {
    if ((error as any).code !== 'ENOENT') {
      console.error(`Error reading plugins directory ${pluginsPath}:`, error);
    }
  }

  return manifests;
}

/**
 * プロジェクト設定を保存します。
 * @param projectPath プロジェクトのルートパス
 * @param config 設定オブジェクト
 */
export async function saveProject(
  projectPath: string,
  config: ProjectConfig,
): Promise<void> {
  await StorageService.getInstance().saveLocal(projectPath, CONFIG_FILE, config);
}
