import { Database } from 'lucide-react';
import { Panel } from '../../types/panel';
import './MetadataPropertyEditor.css';

interface MetadataPropertyEditorProps {
  metadata?: Record<string, any>;
  onMetadataChange?: (metadata: Record<string, any>) => void;
}

export function MetadataPropertyEditor({
  metadata = {},
  onMetadataChange = () => {},
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

  return (
    <div className="metadata-property-editor">
      <div className="editor-field">
        <label htmlFor="meta-title">タイトル</label>
        <input
          id="meta-title"
          type="text"
          value={metadata.title || ''}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="文書のタイトル"
        />
      </div>

      <div className="editor-field">
        <label htmlFor="meta-tags">タグ (カンマ区切り)</label>
        <input
          id="meta-tags"
          type="text"
          value={
            Array.isArray(metadata.tags)
              ? metadata.tags.join(', ')
              : metadata.tags || ''
          }
          onChange={handleTagsChange}
          placeholder="char, location, etc..."
        />
      </div>

      <div className="editor-field">
        <label htmlFor="meta-summary">あらすじ / メモ</label>
        <textarea
          id="meta-summary"
          value={metadata.summary || metadata.description || ''}
          onChange={(e) => handleChange('summary', e.target.value)}
          rows={10}
          placeholder="このファイルに関するメモやあらすじを入力してください"
        />
      </div>
    </div>
  );
}

export const metadataPropertyEditorPanelConfig: Panel = {
  id: 'metadata-editor',
  title: 'プロパティ',
  icon: <Database size={24} strokeWidth={1.5} />,
  component: MetadataPropertyEditor,
  defaultLocation: 'right',
};
