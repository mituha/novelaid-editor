import { NovelaidDocumentType } from '../novelaid-fs';
import { DocumentViewMode } from './types';

/**
 * 指定されたドキュメントタイプでサポートされているビュータイプの一覧を取得します。
 */
export function getSupportedViewModes(docType: NovelaidDocumentType | string | undefined): DocumentViewMode[] {
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
export function isViewModeSupported(
  docType: NovelaidDocumentType | string | undefined,
  viewMode: DocumentViewMode,
): boolean {
  if (!docType) return viewMode === 'editor';
  const supported = getSupportedViewModes(docType);
  return supported.includes(viewMode);
}
