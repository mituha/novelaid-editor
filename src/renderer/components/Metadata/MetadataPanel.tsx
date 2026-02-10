import React, { useState, useEffect } from 'react';
import { Tag, FileText, Plus, X } from 'lucide-react';
import './MetadataPanel.css';

interface MetadataPanelProps {
  activePath?: string | null;
  metadata?: Record<string, any>;
  onMetadataChange?: (metadata: Record<string, any>) => void;
}

export const MetadataPanel: React.FC<MetadataPanelProps> = ({
  activePath,
  metadata = {},
  onMetadataChange,
}) => {
  const [localMetadata, setLocalMetadata] = useState<Record<string, any>>(metadata);
  const [newKey, setNewKey] = useState('');

  useEffect(() => {
    setLocalMetadata(metadata);
  }, [metadata]);

  if (!activePath) {
    return (
      <div className="metadata-panel-empty">
        <p>ファイルを選択してメタデータを表示</p>
      </div>
    );
  }

  const handleChange = (key: string, value: any) => {
    const updated = { ...localMetadata, [key]: value };
    setLocalMetadata(updated);
    onMetadataChange?.(updated);
  };

  const handleRemove = (key: string) => {
    const updated = { ...localMetadata };
    delete updated[key];
    setLocalMetadata(updated);
    onMetadataChange?.(updated);
  };

  const handleAdd = () => {
    if (newKey && !localMetadata[newKey]) {
      const updated = { ...localMetadata, [newKey]: '' };
      setLocalMetadata(updated);
      onMetadataChange?.(updated);
      setNewKey('');
    }
  };

  return (
    <div className="metadata-panel">
      <div className="section-title">
        <Tag size={16} />
        <span>基本情報</span>
      </div>
      <div className="metadata-grid">
        <div className="metadata-item">
          <label>タグ (カンマ区切り)</label>
          <input
            type="text"
            value={localMetadata.tags || ''}
            onChange={(e) => handleChange('tags', e.target.value)}
            placeholder="例: 小説, 推敲中"
          />
        </div>
        <div className="metadata-item">
          <label>概要</label>
          <textarea
            value={localMetadata.summary || ''}
            onChange={(e) => handleChange('summary', e.target.value)}
            placeholder="ドキュメントの概要を入力..."
          />
        </div>
      </div>

      <div className="section-title">
        <Plus size={16} />
        <span>カスタムメタデータ</span>
      </div>
      <div className="custom-metadata-list">
        {Object.entries(localMetadata)
          .filter(([key]) => key !== 'tags' && key !== 'summary')
          .map(([key, value]) => (
            <div key={key} className="custom-item">
              <div className="item-key">{key}</div>
              <div className="item-value-container">
                <input
                  type="text"
                  value={String(value)}
                  onChange={(e) => handleChange(key, e.target.value)}
                />
                <button
                  className="remove-btn"
                  onClick={() => handleRemove(key)}
                  title="削除"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
      </div>

      <div className="add-metadata">
        <input
          type="text"
          placeholder="新しいキー名..."
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
        />
        <button onClick={handleAdd}>追加</button>
      </div>
    </div>
  );
};
