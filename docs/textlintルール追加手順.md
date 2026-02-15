# 文章校正ルールの追加手順書

本アプリでは、パッケージ版での動作安定性のために `textlint` ルールをプログラム内で直接読み込む方式（Programmatic API）を採用しています。新しいルールを追加する際は、以下のステップに従ってください。

## 1. ライブラリのインストール

まず、使用したい `textlint` ルールを依存関係に追加します。
**注意**: 全体の `package.json` と、パッケージング用の `release/app/package.json` の**両方**に追加する必要があります。

```bash
# ルート直下で実行
npm install textlint-rule-your-rule-name
cd release/app
npm install textlint-rule-your-rule-name
```

## 2. メインプロセスへのインポートと登録

`src/main/calibration/CalibrationService.ts` を編集します。

### インポートの追加
ファイルの先頭付近にルールをインポートします。

```typescript
import yourRule from 'textlint-rule-your-rule-name';
```

### ルールリストへの追加
`initialize` メソッド内の `rules` 配列に追加します。

```typescript
const customRule = getModule(yourRule);
if (customRule) {
  rules.push({ 
    ruleId: 'your-rule-id', 
    rule: customRule,
    options: { /* 必要ならオプション */ } 
  });
}
```

## 3. 設定画面へのトグル追加

ユーザーが設定画面から有効・無効を切り替えられるようにします。

### 設定コンテキストの更新
`src/renderer/contexts/SettingsContext.tsx` の `ProjectConfig` インターフェースと初期値に、新しい項目のキーを追加します。

### 設定タブ UI の更新
`src/renderer/components/Settings/Tabs/CalibrationSettingsTab.tsx` にチェックボックスを追加します。

```tsx
<div className="settings-item">
  <label>
    <input
      type="checkbox"
      disabled={!calibration.textlint}
      checked={calibration.yourRuleKey}
      onChange={() => handleToggle('yourRuleKey')}
    />
    ルールの表示名
  </label>
</div>
```

## 4. 指摘のフィルタリング設定

`src/main/calibration/CalibrationService.ts` の `runTextlint` メソッド内で、追加した設定値に基づいてフィルタリングを行うロジックを追加します。

```typescript
if (msg.ruleId === 'your-rule-id') isEnabled = !!settings.yourRuleKey;
```

## 5. UI でのグループ分け（任意）

必要に応じて、`runTextlint` 内で `type` を指定することで、校正パネル上のグループ（助詞の連続、表記ゆれ等）を指定できます。デフォルトは `textlint` グループに表示されます。
