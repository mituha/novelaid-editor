作業予定、未解決の問題等のメモ
================================

## TODO

メタデータ用の右ペインの表示をマークダウンと小説の対応時のみとする。

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

pathの処理を変更した後にタブのタイトル部分等がおかしくなっています。
具体的には名称としてファイル名だけの予定が絶対パス(`D:\hoges\issues.md`)のようになってしまっている。
また、同一タブグループに同一ファイルがファイル名のみと絶対パスの２つで表示されるため、documentsのキーとして別物として処理されていると考えられます。
現在、documentsのキーとして処理されるパスはどのようになっていますか？
絶対パス、相対パス、その他のどれですか？
ここで使用できるパスとしての正規化メソッドを`project:xxx`のようにプロジェクト区分で定義して処理するべきかも。
特にプロジェクトからの相対パスで扱う場合はproject区分での処理が必要。

FileNameHeader部分にフルパス(拡張子なし)が表示されています。
元々、この部分へはファイルタイトル(ディレクトリなし、拡張子なし)のみを表示する仕様です。
また、簡易的にファイル名の変更ができるようになっています。
ファイル名のみの表示が行われるように修正してください

#### 特定のファイルの読込時のみエラーが出る

preview://D:/home/mituha/repos/novelaid-editor-next/doc/猫モフApps/02_プロジェクト選択.md Error: Error invoking remote method 'fs:readDocument': Error: ENOENT: no such file or directory, open 'D:\home\mituha\repos\novelaid-editor\preview:\D:\home\mituha\repos\novelaid-editor-next\doc\猫モフApps\02_プロジェクト選択.md'

preview用のパスの名前に対して、開こうとしているパスがおかしい。
* fs:readDocument等、ドキュメントに渡すパスはURIスキームを除いた絶対パスであるべき。
* URIスキーム自体が現状の過渡期の対応なので、documentType、documentViewType、documentPathから判別、扱われるべきです。
* URIスキームを含んでいるかもしれないパスから、ドキュメントとして扱える絶対パスを生成するメソッドが未定義であれば定義してください。
  + 他の類似のメソッド同様、プラグインや拡張機能でも利用できるようにDocumentContextに定義してください。
    + 他に適切な定義位置があるかも検討、確認してください。
  + 引数としては他の補助情報(documentType, documentViewType)も渡せるようにしてください。
* URIスキームの扱い自体も、将来的に変更される可能性を考慮して、直接個々に処理している箇所は一元的に処理するようにしてください。





Uncaught TypeError: this.getData is not a function
    at Object.exitCodeText (from-markdown.js:42:1)
    at compile (index.js:254:1)
    at fromMarkdown (index.js:83:1)
    at parser (index.js:33:24)
    at apply.parse (index.js:668:1)
    at Markdown (index.js:178:1)
    at Object.react_stack_bottom_frame (react-dom-client.development.js:25904:1)
    at renderWithHooks (react-dom-client.development.js:7662:1)
    at updateFunctionComponent (react-dom-client.development.js:10166:1)
    at beginWork (react-dom-client.development.js:11778:1)



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




