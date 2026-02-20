import React from 'react';
import { Database, User, MapPin, ScrollText } from 'lucide-react';
import { Panel } from '../../types/panel';
import './MetadataPropertyEditor.css';

interface MetadataPropertyEditorProps {
  metadata?: Record<string, any>;
  onMetadataChange?: (metadata: Record<string, any>) => void;
  onBlur?: () => void;
}

export function MetadataPropertyEditor({
  metadata = {},
  onMetadataChange = () => {},
  onBlur = () => {},
}: MetadataPropertyEditorProps) {
  const handleChange = (key: string, value: any) => {
    if (onMetadataChange) {
      onMetadataChange({ ...metadata, [key]: value });
    }
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tags = e.target.value
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t !== '');
    handleChange('tags', tags);
  };

  const tagGroups = [
    {
      id: 'character',
      label: '登場人物',
      icon: <User size={14} />,
      tags: ['character', '登場人物', '人名', '人物', 'chara'],
      primary: 'character',
    },
    {
      id: 'location',
      label: '地名・施設',
      icon: <MapPin size={14} />,
      tags: [
        'location',
        'places',
        '地名',
        '施設',
        '場所',
        'place',
        'geo',
        'geography',
      ],
      primary: 'location',
    },
    {
      id: 'plot',
      label: 'プロット',
      icon: <ScrollText size={14} />,
      tags: ['plot', '構成', 'プロット', '案', 'timeline', '時間軸', '年表'],
      primary: 'plot',
    },
  ];

  const currentTags: string[] = Array.isArray(metadata.tags)
    ? metadata.tags
    : [];

  const toggleTagGroup = (groupId: string) => {
    const group = tagGroups.find((g) => g.id === groupId);
    if (!group) return;

    const hasAny = group.tags.some((t) => currentTags.includes(t));
    let newTags: string[];

    if (hasAny) {
      // Remove all tags associated with this group
      newTags = currentTags.filter((t) => !group.tags.includes(t));
    } else {
      // Add primary tag
      newTags = [...currentTags, group.primary];
    }

    handleChange('tags', newTags);
  };

  return (
    <div className="metadata-property-editor">
      <div className="editor-field">
        <label htmlFor="meta-title">
          <span className="field-label">タイトル</span>
          <input
            id="meta-title"
            type="text"
            value={metadata.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            onBlur={onBlur}
            placeholder="文書のタイトル"
          />
        </label>
      </div>

      <div className="editor-field">
        <span className="field-label">クイックタグ</span>
        <div className="tag-toggle-buttons">
          {tagGroups.map((group) => {
            const isActive = group.tags.some((t) => currentTags.includes(t));
            return (
              <button
                key={group.id}
                type="button"
                className={`tag-toggle-btn ${isActive ? 'active' : ''}`}
                onClick={() => toggleTagGroup(group.id)}
                title={group.label}
              >
                {group.icon}
                <span>{group.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="editor-field">
        <label htmlFor="meta-tags">
          <span className="field-label">タグ (カンマ区切り)</span>
          <input
            id="meta-tags"
            type="text"
            value={currentTags.join(', ')}
            onChange={handleTagsChange}
            onBlur={onBlur}
            placeholder="char, location, etc..."
          />
        </label>
      </div>

      <div className="editor-field">
        <label htmlFor="meta-summary">
          <span className="field-label">あらすじ / メモ</span>
          <textarea
            id="meta-summary"
            value={metadata.summary || metadata.description || ''}
            onChange={(e) => handleChange('summary', e.target.value)}
            onBlur={onBlur}
            rows={10}
            placeholder="このファイルに関するメモやあらすじを入力してください"
          />
        </label>
      </div>
    </div>
  );
}

// Add static properties to fix prop-type warning if needed,
// though destructuring with defaults is usually enough for modern React
MetadataPropertyEditor.defaultProps = {
  metadata: {},
  onMetadataChange: () => {},
  onBlur: () => {},
};

export const metadataPropertyEditorPanelConfig: Panel = {
  id: 'metadata-editor',
  title: 'プロパティ',
  icon: <Database size={24} strokeWidth={1.5} />,
  component: MetadataPropertyEditor,
  defaultLocation: 'right',
};
