import React, { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
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

export function MetadataListPanel({
  onFileSelect,
}: {
  onFileSelect: (path: string, data: any) => void;
}) {
  const { settings, updateSettings } = useSettings();
  const [lists, setLists] = useState<ListConfig[]>(
    settings.metadataLists || [],
  );
  const [results, setResults] = useState<Record<string, MetadataEntry[]>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [newList, setNewList] = useState<Partial<ListConfig>>({
    title: '',
    tag: '',
  });

  const fetchResults = useCallback(async () => {
    const newResults: Record<string, MetadataEntry[]> = {};
    await Promise.all(
      lists.map(async (list) => {
        if (list.tag) {
          try {
            const entries = await window.electron.metadata.queryByTag(list.tag);
            newResults[list.id] = entries;
          } catch (err) {
            console.error(`Failed to query tag ${list.tag}`, err);
          }
        }
      }),
    );
    setResults(newResults);
  }, [lists]);

  useEffect(() => {
    fetchResults();
    const cleanup = window.electron.fs.onFileChange(() => {
      fetchResults();
    });
    return () => cleanup();
  }, [fetchResults]);

  const handleAddList = () => {
    if (!newList.title || !newList.tag) return;
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
      <div className="panel-header-actions">
        <button
          type="button"
          className="edit-toggle-btn"
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? '完了' : 'リスト編集'}
        </button>
      </div>

      {isEditing && (
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
          <button type="button" onClick={handleAddList}>追加</button>
        </div>
      )}

      <div className="bookmark-lists">
        {lists.map((list) => (
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
        ))}
      </div>
    </div>
  );
}
