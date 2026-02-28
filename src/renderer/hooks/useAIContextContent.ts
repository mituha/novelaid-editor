import { useCallback } from 'react';
import { useAIContext } from '../contexts/AIContextContext';

interface Tab {
  name: string;
  path: string;
  documentType?: string;
  viewType?: string;
}

export function useAIContextContent() {
  const { contextState } = useAIContext();

  const getContextText = useCallback(async (
    leftActivePath: string | null,
    rightActivePath: string | null,
    leftTabs: Tab[],
    rightTabs: Tab[],
    documents: Record<string, any>
  ): Promise<string> => {
    const paths = new Set<string>();

    // アクティブなドキュメント
    if (contextState.includeLeftActive && leftActivePath) paths.add(leftActivePath);
    if (contextState.includeRightActive && rightActivePath) paths.add(rightActivePath);

    // その他の開いているタブ
    if (contextState.includeAllOpen) {
      leftTabs.forEach(t => paths.add(t.path));
      rightTabs.forEach(t => paths.add(t.path));
    }

    // カスタムで追加されたファイル
    contextState.customPaths.forEach(p => paths.add(p));

    let result = "";
    for (const path of paths) {
      const tab = [...leftTabs, ...rightTabs].find(t => t.path === path);
      if (tab?.viewType === 'preview' || tab?.documentType === 'git-diff' || tab?.documentType === 'browser') {
        continue;
      }

      let content = "";
      if (documents[path]) {
        content = documents[path].content;
      } else {
        // オープンされていない場合はディスクから直接読み込む
        try {
          const data = await window.electron.ipcRenderer.invoke('fs:readDocument', path);
          content = data?.content || "";
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(`Failed to read context file: ${path}`, e);
          continue;
        }
      }

      const fileName = path.split(/[/\\]/).pop() || path;
      if (content) {
        result += `[File: ${fileName}]\n\`\`\`\n${content}\n\`\`\`\n\n`;
      }
    }

    return result;
  }, [contextState]);

  return { getContextText };
}
