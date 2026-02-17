import React, { useState, useEffect, useCallback } from 'react';
import { Users, MapPin, Bookmark } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { Panel } from '../../types/panel';
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
  fixedTag?: string;
}

export default function MetadataListPanel({
  onFileSelect,
  fixedTitle = '',
  fixedTag = '',
}: MetadataListPanelProps) {
  const { settings, updateSettings } = useSettings();
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
        const entries = await window.electron.metadata.queryByTag(fixedTag);
        newResults.fixed = entries;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`Failed to query tag ${fixedTag}`, err);
      }
    } else {
      await Promise.all(
        lists.map(async (list) => {
          if (list.tag) {
            try {
              const entries =
                await window.electron.metadata.queryByTag(list.tag);
              newResults[list.id] = entries;
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error(`Failed to query tag ${list.tag}`, err);
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
  }, [fetchResults]);

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
      const data = await window.electron.ipcRenderer.invoke(
        'fs:readDocument',
        filePath,
      );
      onFileSelect(filePath, data);
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
            <div className="bookmark-header">
              <span className="bookmark-title">{fixedTitle || fixedTag}</span>
            </div>
            <ul className="bookmark-items">
              {(results.fixed || []).map((entry) => (
                <li key={entry.path}>
                  <div
                    className="bookmark-item-link"
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

export const charactersPanelConfig: Panel = {
  id: 'characters',
  title: '登場人物',
  icon: <Users size={24} strokeWidth={1.5} />,
  component: ({ onFileSelect }: any) => (
    <MetadataListPanel
      onFileSelect={onFileSelect}
      fixedTitle="登場人物一覧"
      fixedTag="character"
    />
  ),
  defaultLocation: 'left',
};

export const locationsPanelConfig: Panel = {
  id: 'locations',
  title: '地名・施設',
  icon: <MapPin size={24} strokeWidth={1.5} />,
  component: ({ onFileSelect }: any) => (
    <MetadataListPanel
      onFileSelect={onFileSelect}
      fixedTitle="地名・施設一覧"
      fixedTag="location"
    />
  ),
  defaultLocation: 'left',
};

export const metadataListPanelConfig: Panel = {
  id: 'metadata-list',
  title: '収集一覧',
  icon: <Bookmark size={24} strokeWidth={1.5} />,
  component: MetadataListPanel,
  defaultLocation: 'left',
};
