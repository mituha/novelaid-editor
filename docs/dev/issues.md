作業予定、未解決の問題等のメモ
================================

## TODO

メタデータ用の右ペインの表示をマークダウンと小説の対応時のみとする。

### 検索時、`[` を検索でエラー

### npm start時エラー
```pwsh
npm start
```
この場合のみ起動時にエラーが出る
```
[1] 
[1] App threw an error during load
[1] TSError: ⨯ Unable to compile TypeScript:
[1] .erb/dll/main.bundle.dev.js(63,25): error TS1487: Octal escape sequences are not allowed. Use the syntax '\x1b'.
[1] .erb/dll/main.bundle.dev.js(64,25): error TS1487: Octal escape sequences are not allowed. Use the syntax '\x1b'.
[1] .erb/dll/main.bundle.dev.js(65,25): error TS1487: Octal escape sequences are not allowed. Use the syntax '\x1b'.

//中略

[1] .erb/dll/main.bundle.dev.js(111,25): error TS1487: Octal escape sequences are not allowed. Use the syntax '\x1b'.
[1]
[1]     at createTSError (D:\home\mituha\repos\novelaid-editor\node_modules\ts-node\src\index.ts:859:12)     
[1]     at reportTSError (D:\home\mituha\repos\novelaid-editor\node_modules\ts-node\src\index.ts:863:19)     
[1]     at D:\home\mituha\repos\novelaid-editor\node_modules\ts-node\src\index.ts:1379:34
[1]     at Object.compile (D:\home\mituha\repos\novelaid-editor\node_modules\ts-node\src\index.ts:1451:13)   
[1]     at Module.m._compile (D:\home\mituha\repos\novelaid-editor\node_modules\ts-node\src\index.ts:1617:30)
[1]     at Module._extensions..js (node:internal/modules/cjs/loader:1945:10)
[1]     at Object.require.extensions.<computed> [as .js] (D:\home\mituha\repos\novelaid-editor\node_modules\ts-node\src\index.ts:1621:12)
[1]     at Module.c._load (node:electron/js2c/node_init:2:17999)
[1] [electronmon] uncaught exception occured
[1]     at Module.c._load (node:electron/js2c/node_init:2:17999)
[1] [electronmon] uncaught exception occured
[1] [electronmon] waiting for any change to restart the app
[1] [23336:0308/124632.083:ERROR:content\browser\network_service_instance_impl.cc:610] Network service crashed or was terminated, restarting service.
[1] [electronmon] ignoring exit with code 1
```

```pwsh
npm run package
```
で作成したexeは起動する。

ます、`.erb/dll`の削除。
これによりキャッシュが削除される。
`npm i` で再度インストール。
この処理でpostinstallが走るため、再構築予定。
-> 解消しない

エラーは、"\033[0m"のような8進数表記を使用してはいけないエラー
```
novelaid-editor@0.42.11 D:\home\mituha\repos\novelaid-editor
└─┬ textlint@15.5.2
  └─┬ @textlint/linter-formatter@15.5.2
    └── @azu/style-format@1.0.1
```
この`@azu/style-format`は数年更新がない。
現状、依存関係の問題からそのまま解消はないと考えられます。
```json
/* ここから下を追加！ */
  "ts-node": {
    "transpileOnly": true,
    "skipIgnore": false,
    "ignore": [
      "(?:^|/)node_modules/",
      "\\.erb/dll/"
    ]
  }
```
tsconfig.jsonに上記を追加。


### チャットビュー

コンテキスト選択用コントロールは作成済み。
AI校正にも同一のコンテキスト選択を追加


ソース(ドキュメント)編集モードが欲しい。


### ファイル監視関連の抜本的な構造変更

ファイル削除や名前変更の時に誤動作しており、ファイル監視の仕組みを見直す必要がある。
ファイル監視自体はmain側でwatcher.tsが行っている。
削除時の問題等は解消。

まだ、名前変更時に元のファイルが残っている。
新規作成からエディター上の表示で名前変更した時に元の新規ファイルが残っている。
名前変更時の処理を確認。
//TODO 管理用の内部的なファイル名を先に変更する必要があるかも？


### マークダウン表示

[マークダウンプレビュー](./markdown-preview.md)も参照

### git未インストール時の処理？

メアド、名前の登録状況等をチェックした方が良い？

### エディター部分

#### インテリセンスの調整

* 人名や地名等の候補を出す。
  + リストはメタデータから取得する。
  + これは、登場人物一覧や地名一覧でリストアップしている。
  + 動的に変わる可能性があります。

#### 半角空白等の可視化

Monaco Editor の機能だが、動作していない？

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




