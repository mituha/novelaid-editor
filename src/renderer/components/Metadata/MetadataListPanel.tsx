import React, { useState, useEffect, useCallback } from 'react';
import { Users, MapPin, Bookmark, ScrollText } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useMetadata } from '../../contexts/MetadataContext';
import { Panel } from '../../types/panel';
import { METADATA_UI_DEFS } from '../../constants/metadataUI';
import { getFilePath } from '../../../common/utils/pathUtils';
import './MetadataListPanel.css';

interface MetadataEntry {
  path: string;
  name: string;
  metadata: Record<string, any>;
}

interface ListConfig {
  id: string;
  title: string;
  tag: string;
}

interface MetadataListPanelProps {
  onFileSelect: (path: string, data: any) => void;
  fixedTitle?: string;
  fixedTag?: string | string[];
}

const defaultProps = {
  fixedTitle: '',
  fixedTag: '',
};

export default function MetadataListPanel({
  onFileSelect,
  fixedTag = '',
}: MetadataListPanelProps) {
  const { projectConfig: settings, updateProjectConfig: updateSettings, projectPath } = useProject();
  const { isScanning, scanProgress } = useMetadata();
  const [lists, setLists] = useState<ListConfig[]>(
    fixedTag ? [] : settings.metadataLists || [],
  );
  const [results, setResults] = useState<Record<string, MetadataEntry[]>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [newList, setNewList] = useState<Partial<ListConfig>>({
    title: '',
    tag: '',
  });

  const fetchResults = useCallback(async () => {
    const newResults: Record<string, MetadataEntry[]> = {};

    if (fixedTag) {
      try {
        // Support CSV if its a string
        const tags =
          typeof fixedTag === 'string'
            ? fixedTag
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            : fixedTag;

        const entries = await window.electron.metadata.queryByTag(tags);
        newResults.fixed = entries;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`Failed to query tags ${fixedTag}`, err);
      }
    } else {
      await Promise.all(
        lists.map(async (list) => {
          if (list.tag) {
            try {
              // Support CSV tags in custom lists too
              const tags = list.tag
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean);
              const entries =
                await window.electron.metadata.queryByTag(tags);
              newResults[list.id] = entries;
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error(`Failed to query tags ${list.tag}`, err);
            }
          }
        }),
      );
    }
    setResults(newResults);
  }, [lists, fixedTag]);

  useEffect(() => {
    fetchResults();
    const cleanup = window.electron.fs.onFileChange(() => {
      fetchResults();
    });
    return () => cleanup();
  }, [fetchResults, projectPath]);

  // Re-fetch on scan progress or completion
  useEffect(() => {
    if (!isScanning || scanProgress === 100) {
      // eslint-disable-next-line no-console
      console.log(`[MetadataListPanel] Triggering fetchResults. isScanning: ${isScanning}, progress: ${scanProgress}`);
      fetchResults();
    }
  }, [isScanning, scanProgress, fetchResults]);

  // Sync lists state when project changes or settings update
  useEffect(() => {
    if (!fixedTag) {
      setLists(settings.metadataLists || []);
      setResults({}); // Explicitly clear results when settings or projectPath changes
    }
  }, [settings.metadataLists, fixedTag, projectPath]);

  const handleAddList = () => {
    if (fixedTag || !newList.title || !newList.tag) return;
    const item: ListConfig = {
      id: Date.now().toString(),
      title: newList.title,
      tag: newList.tag,
    };
    const updated = [...lists, item];
    setLists(updated);
    updateSettings({ ...settings, metadataLists: updated });
    setNewList({ title: '', tag: '' });
  };

  const handleRemoveList = (id: string) => {
    if (fixedTag) return;
    const updated = lists.filter((l) => l.id !== id);
    setLists(updated);
    updateSettings({ ...settings, metadataLists: updated });
  };

  const handleFileClick = async (filePath: string) => {
    try {
      const absolutePath = getFilePath(filePath);
      const data = await window.electron.ipcRenderer.invoke(
        'fs:readDocument',
        absolutePath,
      );
      onFileSelect(absolutePath, data);
    } catch (err) {
      console.error('Failed to open file from metadata list', err);
    }
  };

  const handleKeyDown = (path: string) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleFileClick(path);
    }
  };

  return (
    <div className="metadata-list-panel">
      {!fixedTag && (
        <div className="panel-header-actions">
          <button
            type="button"
            className="edit-toggle-btn"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? '完了' : 'リスト編集'}
          </button>
        </div>
      )}

      {isEditing && !fixedTag && (
        <div className="edit-list-section">
          <input
            placeholder="タイトル (例: 登場人物)"
            value={newList.title}
            onChange={(e) => setNewList({ ...newList, title: e.target.value })}
          />
          <input
            placeholder="タグ (例: character)"
            value={newList.tag}
            onChange={(e) => setNewList({ ...newList, tag: e.target.value })}
          />
          <button type="button" onClick={handleAddList}>
            追加
          </button>
        </div>
      )}

      <div className="bookmark-lists">
        {fixedTag ? (
          <div className="bookmark-section">
            <ul className="bookmark-items">
              {(results.fixed || []).map((entry) => (
                <li key={entry.path}>
                  <div
                    className="bookmark-item-link"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', entry.path);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => handleFileClick(entry.path)}
                    onKeyDown={handleKeyDown(entry.path)}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="item-icon">📄</span>
                    <span className="item-name">{entry.name}</span>
                  </div>
                </li>
              ))}
              {(!results.fixed || results.fixed.length === 0) && (
                <li className="empty-bookmark-msg">なし</li>
              )}
            </ul>
          </div>
        ) : (
          lists.map((list) => (
            <div key={list.id} className="bookmark-section">
              <div className="bookmark-header">
                <span className="bookmark-title">{list.title}</span>
                {isEditing && (
                  <button
                    type="button"
                    className="remove-list-btn"
                    onClick={() => handleRemoveList(list.id)}
                  >
                    ✕
                  </button>
                )}
              </div>
              <ul className="bookmark-items">
                {(results[list.id] || []).map((entry) => (
                  <li key={entry.path}>
                    <div
                      className="bookmark-item-link"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', entry.path);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={() => handleFileClick(entry.path)}
                      onKeyDown={handleKeyDown(entry.path)}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="item-icon">📄</span>
                      <span className="item-name">{entry.name}</span>
                    </div>
                  </li>
                ))}
                {(!results[list.id] || results[list.id].length === 0) && (
                  <li className="empty-bookmark-msg">なし</li>
                )}
              </ul>
            </div>
          ))
        )}
        {!fixedTag && lists.length === 0 && !isEditing && (
          <div className="empty-panel-msg">
            「リスト編集」から収集対象を追加してください。
          </div>
        )}
      </div>
    </div>
  );
}

MetadataListPanel.defaultProps = defaultProps;

export const charactersPanelConfig: Panel = {
  id: METADATA_UI_DEFS.CHARACTER.id,
  title: METADATA_UI_DEFS.CHARACTER.title,
  icon: <METADATA_UI_DEFS.CHARACTER.Icon size={24} strokeWidth={1.5} />,
  component: ({ onFileSelect }: any) => (
    <MetadataListPanel
      onFileSelect={onFileSelect}
      fixedTitle={`${METADATA_UI_DEFS.CHARACTER.title}一覧`}
      fixedTag={METADATA_UI_DEFS.CHARACTER.tags.join(',')}
    />
  ),
  defaultLocation: 'left',
};

export const locationsPanelConfig: Panel = {
  id: METADATA_UI_DEFS.LOCATION.id,
  title: METADATA_UI_DEFS.LOCATION.title,
  icon: <METADATA_UI_DEFS.LOCATION.Icon size={24} strokeWidth={1.5} />,
  component: ({ onFileSelect }: any) => (
    <MetadataListPanel
      onFileSelect={onFileSelect}
      fixedTitle={`${METADATA_UI_DEFS.LOCATION.title}一覧`}
      fixedTag={METADATA_UI_DEFS.LOCATION.tags.join(',')}
    />
  ),
  defaultLocation: 'left',
};

export const plotsPanelConfig: Panel = {
  id: METADATA_UI_DEFS.PLOT.id,
  title: METADATA_UI_DEFS.PLOT.title,
  icon: <METADATA_UI_DEFS.PLOT.Icon size={24} strokeWidth={1.5} />,
  component: ({ onFileSelect }: any) => (
    <MetadataListPanel
      onFileSelect={onFileSelect}
      fixedTitle={`${METADATA_UI_DEFS.PLOT.title}一覧`}
      fixedTag={METADATA_UI_DEFS.PLOT.tags.join(',')}
    />
  ),
  defaultLocation: 'left',
};

export const metadataListPanelConfig: Panel = {
  id: METADATA_UI_DEFS.GENERAL.id,
  title: METADATA_UI_DEFS.GENERAL.title,
  icon: <METADATA_UI_DEFS.GENERAL.Icon size={24} strokeWidth={1.5} />,
  component: MetadataListPanel,
  defaultLocation: 'left',
};
