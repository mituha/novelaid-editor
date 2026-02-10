import path from 'path';
import fs from 'fs/promises';
import matter from 'gray-matter';

export interface DocumentData {
  content: string;
  metadata: Record<string, any>;
}

const NOVELAID_DIR = '.novelaid';
const METADATA_DIR = 'metadata';

/**
 * ファイルパスからプロジェクトのルートディレクトリを探索します。
 */
async function findProjectRoot(filePath: string): Promise<string | null> {
  let current = path.dirname(filePath);
  const root = path.parse(current).root;

  while (current !== root) {
    try {
      await fs.access(path.join(current, NOVELAID_DIR));
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return null;
}

/**
 * サイドカーメタデータの保存パスを取得します。
 */
async function getSidecarPath(filePath: string): Promise<string | null> {
  const projectRoot = await findProjectRoot(filePath);
  if (!projectRoot) return null;

  const relativePath = path.relative(projectRoot, filePath);
  return path.join(projectRoot, NOVELAID_DIR, METADATA_DIR, `${relativePath}.json`);
}

/**
 * ドキュメントとメタデータを読み込みます。
 */
export async function readDocument(filePath: string): Promise<DocumentData> {
  const content = await fs.readFile(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.md' || ext === '.markdown') {
    const { data, content: body } = matter(content);
    return {
      content: body,
      metadata: data,
    };
  }

  // Markdown以外はサイドカーファイルをチェック
  const sidecarPath = await getSidecarPath(filePath);
  if (sidecarPath) {
    try {
      const metadataJson = await fs.readFile(sidecarPath, 'utf-8');
      return {
        content,
        metadata: JSON.parse(metadataJson),
      };
    } catch {
      // メタデータがない場合は空
      return {
        content,
        metadata: {},
      };
    }
  }

  return {
    content,
    metadata: {},
  };
}

/**
 * ドキュメントとメタデータを保存します。
 */
export async function saveDocument(
  filePath: string,
  data: DocumentData,
): Promise<void> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.md' || ext === '.markdown') {
    const fileContent = matter.stringify(data.content, data.metadata);
    await fs.writeFile(filePath, fileContent, 'utf-8');
    return;
  }

  // Markdown以外はコンテンツ本体とサイドカーを分けて保存
  await fs.writeFile(filePath, data.content, 'utf-8');

  const sidecarPath = await getSidecarPath(filePath);
  if (sidecarPath) {
    try {
      await fs.mkdir(path.dirname(sidecarPath), { recursive: true });
      await fs.writeFile(
        sidecarPath,
        JSON.stringify(data.metadata, null, 2),
        'utf-8',
      );
    } catch (error) {
      console.error(`Failed to save sidecar metadata for ${filePath}:`, error);
    }
  }
}
