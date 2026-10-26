# novelaidattributes 仕様（概要）

`.novelaidattributes` は、プロジェクト内のファイルやディレクトリのドキュメントタイプ（`NovelaidDocumentType`）をローカルに定義・カスタマイズするための設定ファイルです（非再帰・局所適用の原則）。

## 共通仕様へのリンク

プログラム言語および特定の実装に依存しない共通仕様（構文規則、ワイルドカード照合、判定アルゴリズム、実例）は、共通ドキュメントリポジトリ `novelaid-editor-docs` に集約・管理されています。

- **共通仕様書**: [novelaidattributes 共通仕様](../../novelaid-editor-docs/docs/dev/novelaidattributes仕様.md)

## 本プロジェクトにおける実装

`novelaid-editor`（Electron版）では、メインプロセスのファイルシステム層にて実装されています：
- 実装ファイル: `src/novelaid-fs/main/FileService.ts`
- キャッシュ管理: `attributeCache`（`mtime` によるメモリキャッシュおよび破棄）
