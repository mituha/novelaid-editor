# novelagent-editor

小説執筆支援のための拡張可能なデスクトップエディタです。Electron, React, TypeScript で構築されています。

## はじめに

このプロジェクトは、作者が自身の小説執筆のために開発しています。
また、バイブコーディングでプログラミングをするための実験的なプロジェクトでもあります。
そのため、As is で公開されています。
ファイル表示、エディター、ローカルAIアシスタントの雛形ぐらいにはなるかもしれません。

## 特徴

※未実装を含みます

- **プロジェクト管理**: `.novelagent` ディレクトリを使用したプロジェクト構造の管理。
- **プラグインアーキテクチャ**: 機能拡張を容易にするためのプラグインシステム（設定画面へのタブ登録機構など）。
- **柔軟な設定管理**: Obsidian ライクな設定モーダルUIと、JSON形式での設定永続化。
- **モダンな技術スタック**:
  - Electron
  - React
  - TypeScript
  - Webpack (Hot Module Replacement 対応)
  - Monaco Editor

## 開発環境のセットアップ

### 前提条件

- Node.js (v14以上推奨)
- npm

### インストール

リポジトリをクローンし、依存関係をインストールします。

```bash
git clone https://github.com/mituha/novelagent-editor.git
cd novelagent-editor
npm install
```

### 開発モードでの起動

以下のコマンドでアプリケーションを開発モードで起動します。

```bash
npm start
```

### ビルドとパッケージング

プロダクション向けのパッケージ（インストーラー等）を作成するには以下のコマンドを実行します。

```bash
npm run package
```

## 謝辞

本プロジェクトは [Electron React Boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate) をテンプレートとして使用しています。
また、本プロジェクトは生成AIによるバイブコーディング (Vibecoding) を活用して開発されています。

## ライセンス

MIT © [Mizuki Mituha](https://github.com/mituha)
