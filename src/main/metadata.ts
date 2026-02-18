import path from 'path';
import fs from 'fs/promises';
import matter from 'gray-matter';

export interface DocumentData {
  content: string;
  metadata: Record<string, any>;
  lineOffset?: number;
  language?: string;
}

const NOVELAID_DIR = '.novelaid';

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
 * Calculate line offset from frontmatter
 */
export function calculateLineOffset(content: string): number {
    const { matter: rawFrontmatter } = matter(content);
    if (rawFrontmatter) {
        return rawFrontmatter.trim().split('\n').length + 2;
    }
    return 0;
}

// Cache for .novelignore instances
const ignoreCache = new Map<string, { mtime: number; instance: any }>();

/**
 * ファイルの言語を判定します。
 */
export async function getLanguageForFile(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.txt') return 'novel';
    if (ext !== '.md' && ext !== '.markdown') return 'markdown';

    // .md / .markdown の場合、.novelignore をチェック
    const projectRoot = await findProjectRoot(filePath);
    if (!projectRoot) return 'novel'; // デフォルトは novel

    const ignorePath = path.join(projectRoot, '.novelignore');
    try {
        const stats = await fs.stat(ignorePath);
        let ignoreInstance;

        const cached = ignoreCache.get(projectRoot);
        if (cached && cached.mtime === stats.mtimeMs) {
            ignoreInstance = cached.instance;
        } else {
            const ignore = require('ignore');
            const content = await fs.readFile(ignorePath, 'utf-8');
            ignoreInstance = ignore().add(content);
            ignoreCache.set(projectRoot, { mtime: stats.mtimeMs, instance: ignoreInstance });
        }

        const relativePath = path.relative(projectRoot, filePath);
        // ignore package expects forward slashes
        const normalizedRelativePath = relativePath.replace(/\\/g, '/');

        if (ignoreInstance.ignores(normalizedRelativePath)) {
            return 'markdown';
        }
    } catch (err) {
        // .novelignore がない場合は無視してデフォルト(novel)を返す
    }

    return 'novel';
}

export async function readDocument(filePath: string): Promise<DocumentData> {
  const content = await fs.readFile(filePath, 'utf-8');
  const language = await getLanguageForFile(filePath);

  if (language === 'markdown' || language === 'novel') {
    const { data, content: body } = matter(content);

    // Calculate line offset if frontmatter exists
    const lineOffset = calculateLineOffset(content);

    return {
      content: body,
      metadata: data,
      lineOffset,
      language,
    };
  }

  return {
    content,
    metadata: {},
    language,
  };
}

export async function saveDocument(
  filePath: string,
  data: DocumentData,
): Promise<void> {
  const language = data.language || await getLanguageForFile(filePath);

  if (language === 'markdown' || language === 'novel') {
    const fileContent = matter.stringify(data.content, data.metadata);
    await fs.writeFile(filePath, fileContent, 'utf-8');
    return;
  }

  // メタデータ非対応の場合はコンテンツ本体のみ保存
  await fs.writeFile(filePath, data.content, 'utf-8');
}
