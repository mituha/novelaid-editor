import { NovelaidDocumentType } from '../novelaid-fs/models';
import { DocumentViewType } from './types';

/**
 * 指定されたドキュメントタイプでサポートされているビュータイプの一覧を取得します。
 */
export function getSupportedViewTypes(docType: NovelaidDocumentType | string | undefined): DocumentViewType[] {
  switch (docType) {
    case 'novel':
    case 'markdown':
      return ['editor', 'reader', 'preview'];
    case 'chat':
      return ['editor', 'canvas'];
    case 'image':
      return ['reader'];
    case 'css':
      return ['editor'];
    case 'git-diff':
    case 'browser':
      return []; // これらは特殊なタイプで、通常のビュー切り替え対象外
    default:
      return ['editor'];
  }
}

/**
 * 指定されたドキュメントタイプが、特定のビュータイプをサポートしているか判定します。
 */
export function isViewTypeSupported(
  docType: NovelaidDocumentType | string | undefined,
  viewType: DocumentViewType,
): boolean {
  if (!docType) return viewType === 'editor';
  const supported = getSupportedViewTypes(docType);
  return supported.includes(viewType);
}
