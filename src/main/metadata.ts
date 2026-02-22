import path from 'path';
import fs from 'fs/promises';
import matter from 'gray-matter';
import { FileService } from './fs/FileService';

export interface DocumentData {
  content: string;
  metadata: Record<string, any>;
  lineOffset?: number;
  language?: string;
}

const NOVELAID_DIR = '.novelaid';

/**
 * Calculate line offset from frontmatter


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


export async function readDocument(filePath: string): Promise<DocumentData> {
  const language = await FileService.getInstance().getDocumentType(filePath);

  if (language === 'markdown' || language === 'novel') {
    const content = await fs.readFile(filePath, 'utf-8');
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

  // Handle images or other files: body is just null or path, metadata is empty
  // For images, we don't actually need to read the content as text
  return {
    content: '',
    metadata: {},
    language,
  };
}

export async function saveDocument(
  filePath: string,
  data: DocumentData,
): Promise<void> {
  const language = data.language || await FileService.getInstance().getDocumentType(filePath);

  if (language === 'markdown' || language === 'novel') {
    const fileContent = matter.stringify(data.content, data.metadata);
    await fs.writeFile(filePath, fileContent, 'utf-8');
    return;
  }

  // メタデータ非対応の場合はコンテンツ本体のみ保存
  await fs.writeFile(filePath, data.content, 'utf-8');
}
