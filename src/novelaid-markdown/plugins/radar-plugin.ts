import yaml from 'js-yaml';
import { MarkdownPlugin } from '../types';

/**
 * Novelaid Radar 記法を Mermaid のレーダーチャートに変換するプラグイン
 */
export const radarPlugin: MarkdownPlugin = {
  name: 'novelaid-radar',
  codePreprocessors: [
    {
      languages: ['novelaid-radar'],
      preprocess: ({ code, attributes }) => {
        try {
          // YAML セパレーター --- で分割
          // 先頭や途中の --- を考慮して分割
          const parts = code.trim().split(/^---$/m).map(p => p.trim()).filter(p => p !== '');
          
          let header: any = {};
          let data: any = {};

          if (parts.length >= 2) {
            // フロントマター + データ
            header = yaml.load(parts[0]) || {};
            data = yaml.load(parts[1]) || {};
          } else if (parts.length === 1) {
            // データのみ（またはヘッダーのみ）
            data = yaml.load(parts[0]) || {};
          }

          const title = header.title || header['タイトル'] || '';
          const name = header.name || header['名前'] || 'Unnamed';
          const min = header.min !== undefined ? header.min : header['最小'] ;
          const max = header.max !== undefined ? header.max : header['最大'];

          // Mermaid の radar-beta 構文を構築
          let mermaidCode = '';
          
          // フロントマター（タイトル設定）
          if (title) {
            mermaidCode += `---\ntitle: ${JSON.stringify(title)}\n---\n`;
          }
          
          mermaidCode += 'radar-beta\n';
          
          const keys = Object.keys(data);
          if (keys.length > 0) {
            // 軸の定義 (a1, a2, ... の ID を使用して日本語の問題を回避)
            const axisLabels = keys.map((key, index) => `a${index + 1}["${key}"]`).join(', ');
            mermaidCode += `  axis ${axisLabels}\n`;
            
            // データの定義
            const values = keys.map(key => data[key]).join(', ');
            mermaidCode += `  curve c1["${name}"]{${values}}\n`;
          }

          // min/max 設定 (明示的に指定された場合のみ出力)
          if (typeof max === 'number') {
            mermaidCode += `  max ${max}\n`;
          }
          if (typeof min === 'number') {
            mermaidCode += `  min ${min}\n`;
          }

          return {
            language: 'mermaid',
            code: mermaidCode,
            attributes,
          };
        } catch (error) {
          console.error('Failed to parse novelaid-radar:', error);
          // エラー時は Mermaid のエラー表示を利用
          return { 
            language: 'mermaid', 
            code: `radar-beta\n  title "Parse Error: ${error instanceof Error ? error.message : 'Invalid YAML'}"`, 
            attributes 
          };
        }
      },
    },
  ],
};
