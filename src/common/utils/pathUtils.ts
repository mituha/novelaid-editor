/**
 * URIスキーム（preview://, git-diff:// 等）を除去し、純粋な絶対パスを返します。
 */
export function getFilePath(path: string): string {
  if (!path) return '';
  // スキーム:// の形式を置換して除去
  return path.replace(/^(preview|git-diff|web-browser):\/\/+/, '').replace(/^staged\/|^unstaged\//, '');
}

/**
 * ファイルパスをドキュメントの一意なキーとして使用できる形式に正規化します。
 * 主に Windows のバックスラッシュ (\) をスラッシュ (/) に変換し、
 * 重複したスラッシュを除去します。
 */
export function normalizeDocumentPath(path: string): string {
  if (!path) return '';

  // 1. バックスラッシュをスラッシュに変換
  let normalized = path.replace(/\\/g, '/');

  // 2. URIスキームがある場合は、スキーム部分を分離してパス部分のみ正規化
  const match = normalized.match(/^([a-z-]+:\/\/+)(.*)$/i);
  if (match) {
    const scheme = match[1];
    const rest = match[2];
    // パス部分の重複スラッシュなどを正規化（ここでは単純に / 置換のみ既に行われている）
    return scheme + rest.replace(/\/+/g, '/');
  }

  // 3. 重複するスラッシュを 1 つにまとめる
  normalized = normalized.replace(/\/+/g, '/');

  // Windows のドライブレター (C:/) 等の直後のスラッシュは正規化で消えすぎないように注意が必要だが
  // 基本的な / 置換で十分なケースが多い
  return normalized;
}

/**
 * 渡されたパスがドキュメントパスとして正規化されているか確認し、
 * 必要であれば正規化して返します。
 */
export const toDocumentPath = normalizeDocumentPath;
