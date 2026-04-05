import yaml from 'js-yaml';
import { MarkdownPlugin } from '../types';

/**
 * Novelaid Radar 記法を Mermaid のレーダーチャートに変換するプラグイン
 */
export const radarPlugin: MarkdownPlugin = {
  name: 'novelaid-radar',
  codePreprocessors: [
    {
      languages: ['novelaid-radar', 'radar'],
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

          // 1. 各項目の抽出と整理
          const headerData = { ...header };

          // フロントマター用の構成データ (title, config)
          const mermaidFrontmatterData: any = {
            config: headerData.config || {}
          };
          delete headerData.config;

          if (headerData.title || headerData['タイトル']) {
            mermaidFrontmatterData.title = headerData.title || headerData['タイトル'];
          }
          delete headerData.title;
          delete headerData['タイトル'];

          // theme の処理 (config.theme にマッピング)
          const theme = headerData.theme || headerData['テーマ'];
          if (theme) {
            mermaidFrontmatterData.config.theme = theme;
          }
          // デフォルト値の設定
          if (!mermaidFrontmatterData.config.theme) {
            // カラフルなテーマが良いが、デフォルトではない。
            // また、forestにすると現状バックがダークの場合に文字が見えない
            // default | neutral | dark | forest | base
            mermaidFrontmatterData.config.theme = 'dark';
          }
          delete headerData.theme;
          delete headerData['テーマ'];

          // 曲線名用の項目 (name)
          // デフォルト値は空文字列とすることで、タイトルのみのレーダーチャートも描画可能にする
          const curveName = headerData.name || headerData['名前'] || '';
          delete headerData.name;
          delete headerData['名前'];

          // 日本語キーの正規化 (ブロック用コマンドとして扱うため)
          if (headerData['最小'] !== undefined) {
            headerData.min = headerData['最小'];
            delete headerData['最小'];
          }
          if (headerData['最大'] !== undefined) {
            headerData.max = headerData['最大'];
            delete headerData['最大'];
          }
          //形状のデフォルトの設定
          //  graticule = circle | polygon
          //  現状、用途としてステータス表示等であるため、polygonをデフォルトとする
          if (headerData['graticule'] === undefined) {
            headerData.graticule = 'polygon';
          }

          // Mermaid の radar-beta 構文を構築
          let mermaidCode = '';

          // A. フロントマター (title, config を Mermaid 標準として出力)
          if (Object.keys(mermaidFrontmatterData).length > 0) {
            mermaidCode += `---\n${yaml.dump(mermaidFrontmatterData)}---\n`;
          }

          // B. radar-beta ブロックの開始
          mermaidCode += 'radar-beta\n';

          const keys = Object.keys(data);
          if (keys.length > 0) {
            // 軸の定義 (a1, a2, ... の ID を使用して日本語の問題を回避)
            const axisLabels = keys.map((key, index) => `a${index + 1}["${key}"]`).join(', ');
            mermaidCode += `  axis ${axisLabels}\n`;

            // データの定義
            const values = keys.map(key => data[key]).join(', ');
            mermaidCode += `  curve c1["${curveName}"]{${values}}\n`;
          }

          // C. その他の設定項目を「素通し」でコマンドとして出力 (min, max も含む)
          for (const [key, value] of Object.entries(headerData)) {
            if (value === undefined || value === null) continue;

            // Mermaid のコマンド形式 (key value) で出力
            // 文字列にスペースが含まれる場合は念のため引用符で囲む
            const formattedValue = (typeof value === 'string' && value.includes(' '))
              ? `"${value}"`
              : value;

            mermaidCode += `  ${key} ${formattedValue}\n`;
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
