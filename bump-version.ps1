param(
  [ValidateSet("patch", "minor", "major")]
  [string]$Type = "patch"
)

# 1. ルートのバージョンを更新（git tagはまだ作らない）
Write-Host "--- ルートのバージョンを $Type 更新中... ---" -ForegroundColor Cyan
$newVersionRaw = npm version $Type --no-git-tag-version

# 2. 更新されたバージョン番号を抽出（引用符や改行を除去）
$newVersion = $newVersionRaw.Trim().Trim('v')
Write-Host "新しいバージョン: $newVersion" -ForegroundColor Green

# 3. release/app の package.json が存在するか確認して同期
$appPkgPath = "release/app/package.json"
if (Test-Path $appPkgPath) {
    Write-Host "--- $appPkgPath を同期中... ---" -ForegroundColor Cyan
    # --prefix を使って直接そのディレクトリのバージョンを書き換えるわん
    npm version $newVersion --prefix release/app --no-git-tag-version
    Write-Host "同期完了だわん！" -ForegroundColor Magenta
} else {
    Write-Host "警告: $appPkgPath が見つかりませんでした。スキップするわん。" -ForegroundColor Yellow
}

Write-Host "すべての処理が正常に終わったわん！ 🐾" -ForegroundColor Green
