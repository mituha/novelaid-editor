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

```
PS D:\home\mituha\repos\novelaid-editor> npm list remark-gfm
novelaid-editor@0.42.5 D:\home\mituha\repos\novelaid-editor
├── remark-gfm@4.0.1
└─┬ textlint@15.5.2
  └─┬ @textlint/textlint-plugin-markdown@15.5.2
    └─┬ @textlint/markdown-to-ast@15.5.2
      └── remark-gfm@4.0.1 deduped
```j
`textlint@15.5.2`が依存する` @textlint/textlint-plugin-markdown@15.5.2`が基本的に古いライブラリを参照してる。
これらを強制的に新しいものを参照するようにすることで回避。
```
  "overrides": {
    "micromark": "^4.0.2",
    "mdast-util-from-markdown": "^2.0.3",
    "remark-gfm": "^4.0.1"
  }
```

```
# npm の場合
npm ls micromark mdast-util-from-markdown


PS D:\home\mituha\repos\novelaid-editor> npm ls micromark mdast-util-from-markdown
novelaid-editor@0.42.5 D:\home\mituha\repos\novelaid-editor
├─┬ mdast-util-from-markdown@2.0.3
│ └── micromark@4.0.2 deduped
├── micromark@4.0.2
├─┬ react-markdown@10.1.0
│ └─┬ hast-util-to-jsx-runtime@2.3.6
│   ├─┬ mdast-util-mdx-expression@2.0.1
│   │ └── mdast-util-from-markdown@2.0.3 deduped
│   ├─┬ mdast-util-mdx-jsx@3.2.0
│   │ └── mdast-util-from-markdown@2.0.3 deduped
│   └─┬ mdast-util-mdxjs-esm@2.0.1
│     └── mdast-util-from-markdown@2.0.3 deduped
├─┬ remark-gfm@4.0.1
│ └─┬ mdast-util-gfm@3.1.0
│   ├── mdast-util-from-markdown@2.0.3 deduped
│   ├─┬ mdast-util-gfm-footnote@2.1.0
│   │ └── mdast-util-from-markdown@2.0.3 deduped
│   ├─┬ mdast-util-gfm-strikethrough@2.0.0
│   │ └── mdast-util-from-markdown@2.0.3 deduped
│   ├─┬ mdast-util-gfm-table@2.0.0
│   │ └── mdast-util-from-markdown@2.0.3 deduped
│   └─┬ mdast-util-gfm-task-list-item@2.0.0
│     └── mdast-util-from-markdown@2.0.3 deduped
├─┬ remark-parse@11.0.0
│ └── mdast-util-from-markdown@2.0.3 deduped
└─┬ textlint@15.5.2
  └─┬ @textlint/textlint-plugin-markdown@15.5.2
    └─┬ @textlint/markdown-to-ast@15.5.2
      ├─┬ mdast-util-gfm-autolink-literal@0.1.3
      │ └── micromark@2.11.4
      ├─┬ remark-footnotes@3.0.0
      │ ├─┬ mdast-util-footnote@0.1.7
      │ │ └── micromark@2.11.4
      │ └─┬ micromark-extension-footnote@0.3.2
      │   └── micromark@2.11.4
      ├─┬ remark-gfm@1.0.0
      │ └─┬ micromark-extension-gfm@0.3.3
      │   ├─┬ micromark-extension-gfm-autolink-literal@0.5.7
      │   │ └── micromark@2.11.4 deduped
      │   ├─┬ micromark-extension-gfm-strikethrough@0.6.5
      │   │ └── micromark@2.11.4 deduped
      │   ├─┬ micromark-extension-gfm-table@0.4.3
      │   │ └── micromark@2.11.4 deduped
      │   ├─┬ micromark-extension-gfm-task-list-item@0.3.3
      │   │ └── micromark@2.11.4 deduped
      │   └── micromark@2.11.4 deduped
      └─┬ remark-parse@9.0.0
        └─┬ mdast-util-from-markdown@0.8.5
          └── micromark@2.11.4 deduped
```
micromark@4.0.2 に対して、textlintが対応していないのが問題。
micromark@2.11.4
```
{
  "overrides": {
    "micromark": "^4.0.2",
    "mdast-util-from-markdown": "^2.0.3",
  }
}
```
node_modulesを削除して再インストール
ビルドエラーになる。

```
 npm explain  micromark
 ```

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




