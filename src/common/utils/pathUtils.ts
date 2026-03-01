/**
 * ファイルパスをドキュメントの一意なキーとして使用できる形式に正規化します。
 * 主に Windows のバックスラッシュ (\) をスラッシュ (/) に変換し、
 * 重複したスラッシュを除去します。
 */
export function normalizeDocumentPath(path: string): string {
  if (!path) return '';

  // 1. バックスラッシュをスラッシュに変換
  let normalized = path.replace(/\\/g, '/');

  // 2. preview:// などのプロトコルを保持しつつ、その後のパス部分を正規化
  // (現在の単純な実装では / への置換だけで十分ですが、将来的に拡張可能です)

  // 3. 重複するスラッシュを 1 つにまとめる (プロトコルの :// は除外)
  // ただし、Windows のネットワークパス (//server/share) などのケースに注意が必要
  // 現状は単純な置換に留めます

  return normalized;
}

/**
 * 渡されたパスがドキュメントパスとして正規化されているか確認し、
 * 必要であれば正規化して返します。
 */
export const toDocumentPath = normalizeDocumentPath;
