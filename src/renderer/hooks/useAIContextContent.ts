import { useCallback } from 'react';
import { useAIContext } from '../contexts/AIContextContext';
import { getFilePath } from '../../common/utils/pathUtils';
import { TabItem, DocumentState } from '../contexts/DocumentContext';

export function useAIContextContent() {
  const { contextState } = useAIContext();

  const getContextText = useCallback(async (
    activeLeftItem: TabItem | null,
    activeRightItem: TabItem | null,
    openDocuments: DocumentState[]
  ): Promise<string> => {
    const paths = new Set<string>();

    // アクティブなドキュメント
    if (contextState.includeLeftActive && activeLeftItem) paths.add(activeLeftItem.path);
    if (contextState.includeRightActive && activeRightItem) paths.add(activeRightItem.path);

    // その他の開いているタブ
    if (contextState.includeAllOpen) {
      openDocuments.forEach(doc => paths.add(doc.path));
    }

    // カスタムで追加されたファイル
    contextState.customPaths.forEach(p => paths.add(p));

    let result = "";
    for (const path of paths) {
      // openDocuments から該当するドキュメントを探す
      const document = openDocuments.find(d => d.path === path);

      // gitDiff や browser などは除外（プレビューは meta 情報などで判定可能だが、今は path で判定）
      if (path.startsWith('gitDiff://') || path.startsWith('browser://')) {
        continue;
      }

      let content = "";
      const absolutePath = getFilePath(path);

      if (document) {
        content = document.content;
      } else {
        // オープンされていない場合はディスクから直接読み込む
        try {
          const data = await window.electron.ipcRenderer.invoke('fs:readDocument', absolutePath);
          content = data?.content || "";
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(`Failed to read context file: ${absolutePath}`, e);
          continue;
        }
      }

      const fileName = absolutePath.split(/[/\\]/).pop() || absolutePath;
      if (content) {
        result += `[File: ${fileName}]\n\`\`\`\n${content}\n\`\`\`\n\n`;
      }
    }

    return result;
  }, [contextState]);

  return { getContextText };
}
