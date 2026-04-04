/**
 * kebab-case を camelCase に変換する
 */
export function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * コードブロックの属性（{key=value, key2} 形式）をパースする
 */
export function parseAttributes(attrString: string | null | undefined): Record<string, any> {
  const attrs: Record<string, any> = {};
  if (!attrString) return attrs;

  let cleanStr = attrString.trim();
  
  // 波括弧で囲まれている場合は中身を取り出す
  if (cleanStr.startsWith('{') && cleanStr.endsWith('}')) {
    cleanStr = cleanStr.substring(1, cleanStr.length - 1).trim();
  } else if (cleanStr.startsWith('{')) {
    // 閉じ括弧がない場合などは開始からパースを試みる
    cleanStr = cleanStr.substring(1).trim();
  }

  // key=value もしくは key の形式にマッチ
  // 値はクォートあり（ダブル/シングル）、クォートなしに対応
  // 区切り文字はスペース（またはカンマなどの正規表現に含まれない文字）
  const regex = /([a-zA-Z0-9_-]+)(?:=([^"'\r\n\t ,{}]+|"(?:\\"|[^"])*"|'(?:\\'|[^'])*'))?/g;
  let match;

  while ((match = regex.exec(cleanStr)) !== null) {
    const rawKey = match[1];
    let value: any = match[2];

    // キャメルケース変換 (max-width -> maxWidth)
    const key = toCamelCase(rawKey);

    if (value === undefined) {
      // 値がない場合はフラグ（true）として扱う
      attrs[key] = true;
    } else {
      // クォート除去
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.substring(1, value.length - 1);
      }

      // ユーザーの要望: width, height で数値のみの場合は px を補完する
      if ((key === 'width' || key === 'height') && /^\d+$/.test(value)) {
        value = `${value}px`;
      }

      attrs[key] = value;
    }
  }

  return attrs;
}
