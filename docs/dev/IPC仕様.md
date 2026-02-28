# IPC 通信仕様

本ドキュメントでは、レンダラープロセスとメインプロセスの間で定義されている IPC (Inter-Process Communication) 通信の仕様について記述します。

## 分類と用途

### 1. ファイル操作 (`fs:`)
ローカルファイルシステムへのアクセスを担当します。

| チャンネル名 | 方式 | 説明 | 引数 | 戻り値 |
| :--- | :--- | :--- | :--- | :--- |
| `fs:readDirectory` | invoke | ディレクトリ内容の読み取り | `dirPath: string` | `Promise<FileEntry[]>` |
| `fs:readFile` | invoke | ファイルのテキスト読み込み | `filePath: string` | `Promise<string>` |
| `fs:writeFile` | invoke | ファイルの保存 | `filePath: string, content: string` | `Promise<void>` |
| `fs:readDocument` | invoke | メタデータを含むドキュメント読み込み | `filePath: string` | `Promise<{content: string, metadata: any}>` |
| `fs:saveDocument` | invoke | メタデータを含むドキュメント保存 | `filePath: string, data: any` | `Promise<void>` |
| `fs:createFile` | invoke | 新規ファイル作成 | `filePath: string` | `Promise<string>` |
| `fs:createDirectory` | invoke | 新規ディレクトリ作成 | `dirPath: string` | `Promise<string>` |
| `fs:rename` | invoke | ファイル/ディレクトリ名変更 | `oldPath: string, newPath: string` | `Promise<void>` |
| `fs:move` | invoke | ファイルの移動 | `oldPath: string, newPath: string` | `Promise<boolean>` |
| `fs:copy` | invoke | ファイルのコピー | `srcPath: string, destPath: string` | `Promise<string>` |
| `fs:delete` | invoke | ファイルの削除 | `targetPath: string` | `Promise<void>` |
| `fs:getDocumentType`| invoke | ファイルのドキュメントタイプ判定 | `filePath: string` | `Promise<DocumentType>` |
| `fs:getDirectoryType`| invoke | ディレクトリの推奨タイプ取得 | `dirPath: string` | `Promise<DocumentType>` |
| `fs:file-changed` | send | ファイル変更通知 (Main -> Renderer) | - | `{event: string, path: string}` |

### 2. プロジェクト管理 (`project:`, `recent:`)
プロジェクトの読み込みや履歴管理を担当します。

| チャンネル名 | 方式 | 説明 | 引数 | 戻り値 |
| :--- | :--- | :--- | :--- | :--- |
| `project:load` | invoke | プロジェクトのロード | `projectPath: string` | `Promise<Project>` |
| `project:save-config`| invoke | プロジェクト設定の保存 | `path: string, config: any` | `Promise<void>` |
| `project:create` | invoke | 新規プロジェクト作成 | `{parentDir, name, cloneUrl}` | `Promise<string>` |
| `recent:get` | invoke | 最近使ったプロジェクト一覧取得 | - | `Promise<string[]>` |
| `recent:add` | invoke | 履歴に追加 | `projectPath: string` | `Promise<void>` |
| `recent:remove` | invoke | 履歴から削除 | `projectPath: string` | `Promise<void>` |

### 3. AI機能 (`ai:`)
LLM を使用した生成やチャット機能を担当します。

| チャンネル名 | 方式 | 説明 | 引数 | 戻り値 |
| :--- | :--- | :--- | :--- | :--- |
| `ai:generate` | invoke | テキスト生成 | `prompt: string, config: any` | `Promise<string>` |
| `ai:chat` | invoke | チャット応答 | `messages: any[], config: any` | `Promise<any>` |
| `ai:streamChat` | on | ストリーミングチャット開始 | `messages, config, ...` | (Event-based) |
| `ai:listModels` | invoke | 利用可能なモデル一覧取得 | `config: any` | `Promise<string[]>` |

### 4. 校正・解析機能 (`calibration:`, `search:`, `metadata:`)
テキストの品質チェックや検索を担当します。

| チャンネル名 | 方式 | 説明 | 引数 | 戻り値 |
| :--- | :--- | :--- | :--- | :--- |
| `calibration:analyze`| invoke | テキストの校正・頻出語解析 | `text: string, settings: any`| `Promise<AnalysisResult>` |
| `calibration:reloadRules`| invoke | 校正ルールの再読み込み | - | `Promise<void>` |
| `search:project` | invoke | プロジェクト全体検索 | `query, rootPath, options` | `Promise<SearchResult[]>` |
| `metadata:query` | invoke | タグ等によるファイル検索 | `tagOrTags: string \| string[]`| `Promise<any[]>` |
| `metadata:scan-progress`| send | スキャン進捗通知 (Main -> Renderer)| - | `{progress, status}` |

### 5. ウィンドウ・システム (`window:`, `app:`, `dialog:`, `shell:`, `util:`)
OS 固有機能やユーティリティを担当します。

| チャンネル名 | 方式 | 説明 | 引数 | 戻り値 |
| :--- | :--- | :--- | :--- | :--- |
| `window:setTitle` | invoke | ウィンドウタイトルの設定 | `title: string` | `void` |
| `window:toggleFullScreen`| invoke | フルスクリーンの切り替え | - | `Promise<boolean>` |
| `app:getVersion` | invoke | アプリのバージョン取得 | - | `string` |
| `app:open-file` | on/send | ファイルを開く要求/通知 | `filePath: string` | - |
| `app:close-file` | send | ファイルを閉じる通知 (Main -> Renderer)| `{path, reason}` | - |
| `dialog:openDirectory`| invoke | ディレクトリ選択ダイアログ | - | `Promise<string \| null>` |
| `dialog:confirm` | invoke | 確認ダイアログの表示 | `message: string` | `Promise<boolean>` |
| `shell:openExternal` | invoke | 外部ブラウザ等でURLを開く | `url: string` | `Promise<void>` |
| `util:relative` | invoke | 相対パスの計算 | `from: string, to: string` | `string` |

## 実装上の注意

- **非同期処理**: `invoke` を使用するハンドラーはレンダラー側で `await` する必要があります。
- **エラーハンドリング**: メインプロセスで発生した例外は `invoke` の戻り値としてレンダラーに伝播します。必要に応じて `try-catch` で囲んでください。
- **セキュリティ**: レンダラープロセスからは `preload.ts` で公開された `window.electron` 経由でのみ IPC 通信が可能です。
