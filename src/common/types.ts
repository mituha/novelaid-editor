/**
 * ドキュメントエリアで表示するViewの種類。
 */
export type DocumentViewType = 'none' | 'editor' | 'canvas' | 'reader' | 'preview';

export interface TabItem {
  path: string;
  isPreview: boolean;
}
