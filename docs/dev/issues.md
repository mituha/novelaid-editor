作業予定、未解決の問題等のメモ
================================

## TODO

### メタデータ用の右ペインの表示
メタデータ用の右ペインの表示をマークダウンと小説の対応時のみとする。

### 検索時、`[` を検索でエラー

### チャットビュー

コンテキスト選択用コントロールは作成済み。
AI校正にも同一のコンテキスト選択を追加


### ファイル監視関連の抜本的な構造変更

ファイル削除や名前変更の時に誤動作しており、ファイル監視の仕組みを見直す必要がある。
ファイル監視自体はmain側でwatcher.tsが行っている。
削除時の問題等は解消。

#### 【既知の不具合】自動保存直後の「外部で変更されました」不要な確認ダイアログ
* **事象**:
  執筆中に「〇〇 は外部で変更されました。破棄して再読み込みしますか？」という確認ダイアログが突如ポップアップし、執筆が中断される。
* **原因**:
  1. `src/renderer/contexts/DocumentContext.tsx` 内の `savingPaths` のパス形式不一致:
     - 保存時: `savingPaths.current.add(absolutePath)`（絶対パス）
     - 判定時: `savingPaths.current.has(normalizedPath)`（相対パス）
     - 削除時: `savingPaths.current.delete(path)`（相対パス）
     - 判定キーの形式が一致していないため、自分が保存したイベントであっても「自己保存（自己エコー）」として除外されず、外部変更として処理されていた。
  2. 自動保存（3秒ディレイ）との競合:
     - 自動保存直後に文字入力を継続していると `isDirty: true` の状態になる。
     - その状態で自らの保存による `change` イベントを受信したため、「外部で変更された未保存ファイル」と判定され、ダイアログが表示されてしまう。
* **対応方針（メモ）**:
  - `savingPaths` のキー形式を絶対パスに統一する。
  - あるいは `novelaide` と同様に、執筆中の常時監視を行わずウィンドウフォーカス復帰時同期（`window.onfocus`）に移行するか、ファイルの mtime（最終更新日時）による厳密な自己エコー除外を行う。


### マークダウン表示

[マークダウンプレビュー](./markdown-preview.md)も参照

### git未インストール時の処理？

メアド、名前の登録状況等をチェックした方が良い？

### エディター部分

#### 半角空白等の可視化

Monaco Editor の機能だが、動作していない？

#### Monaco Editor のUI日本語化対応（公式NLSリソースの事前注入）

* **現状と課題**:
  - コンテキストメニュー（右クリック）、検索窓（`Ctrl+F`）の各種トグルボタンのTooltip（「大文字と小文字を区別する」「正規表現を使用」等）、コマンドパレット（`F1`）が英語表記のままとなっている。
  - 過去に `monaco-editor-nls` などを検討したが、Webpack の AST pre-loader ルールが不足しており機能していなかった。
* **Monaco Editor（v0.55+）の落とし穴**:
  - `loader.config` に `'vs/nls': { availableLanguages: { '*': 'ja' } }` を指定すると、Monaco の AMD ローダープラグイン（`vs/nls.messages-loader.js`）が `vs/nls/lang/ja` を require しようとする。
  - しかし公式パッケージ内の `min/vs/nls/lang/ja.js` には AMD の `define(...)` 宣言がなく、単なる `globalThis._VSCODE_NLS_MESSAGES = [...]` 代入スクリプトであるため、AMD ローダーがモジュール定義完了を永久に待ち続けてエラーも出ずに `Loading...` のままハングする。
* **`novelaide`（先行開発版）で確立した解決アーキテクチャ**:
  1. **ローカルアセット配信**:
     - `node_modules/monaco-editor/min/vs` をビルド成果物（Webpack の場合は `CopyWebpackPlugin` 等）へコピーし、ローカル（`/monaco/vs` 等）から配信可能にする（外部CDNへの依存・トラッキング警告・404を完全排除）。
  2. **事前 NLS メッセージ注入**:
     - `CodeEditor.tsx` の描画前に、`/monaco/vs/nls/lang/ja.js`（約295KB）を `<script>` タグで一度だけ事前実行。
     - `globalThis._VSCODE_NLS_MESSAGES` および `globalThis._VSCODE_NLS_LANGUAGE = 'ja'` を事前にグローバルへ注入する。
  3. **安全なローダー設定**:
     - `loader.config` には `paths: { vs: '/monaco/vs' }` のみを渡し、ハング原因となる `'vs/nls'` 設定は渡さない。
     - Monaco 本体の初期化（`editor.main.js`）時に `globalThis._VSCODE_NLS_MESSAGES` が自動参照され、右クリックメニュー・検索窓Tooltip・コマンドパレットを含むすべてのUIが公式の完全な日本語で表示される。


### ファイルドラッグによるテキスト等挿入の機能

とりあえず、ファイルのタイトルが挿入されるところまで実装

ファイルエクスプローラーからドキュメントへのドラッグ操作でファイル名やリンク等の挿入を行いたい。
マークダウンファイルの場合、リンクの形式で挿入したい。
小説ワイルの場合、タイトル等を挿入したい。
これは、登場人物設定のファイル等ではタイトル(ファイル名)として名前を付けているため、簡単に名前入力ができることになる。
ルビ付きの名前の場合、ルビも含めて挿入したい。
これはメタデータ、もしくは、１行目の登録内容を元に処理するほうが良い。
メタデータに登録されている内容を自動更新するような仕組みも必要か？

### 互換調整用

フォルダー内の `.md` -> `.txt` の機能とか
.novelaidattributesで
```
*.md novel
```
としてドキュメントの種類がnovelになっているファイルの拡張子を変換が正しいが、手順が面倒なのでドラッグして登録したファイルの拡張子変換でも良いのでは？

互換調整ではないが、ファイルの結合機能とか欲しくなりそう。
登録したファイル、フォルダーに対する一括処理用のパネルを用意しても良いかも？

## ライブラリのバージョン

eslintのバージョンをv8からv9に一旦上げたのだが、GitHub上でのpublishが通らなくなったいた。
なお、その際、ローカルの`npm i`もエラーが出るようになっていたので、一旦ある程度元に戻した。
ただし、上手く戻せていない可能性もある。
エラーになるのは postinstall の処理中。
また、一旦 `node_modules` を削除してインストールもやり直している。
```pwsh
# キャッシュをクリア
npm cache clean --force
# 再インストール
npm i
```
それでも治らない。
```
Unable to find electron's version number, either install it or specify an explicit version
```
```pwsh
node_modules/.bin/electron -v
v40.6.1
```

https://github.com/electron-userland/electron-builder/issues/9143
electron-builderのバグっぽい。
ルートとrelease/appの両方にpackage.jsonがあるのが原因の模様。
release/appの方でもelectronをインストールすることで回避できた。

eslintのバージョン問題はそのうち順に解消するものとします。




