/**
 * メタデータの収集に使用されるタグの定義
 */
export const METADATA_TAGS = {
  CHARACTER: ['character', '登場人物', '人名', '人物', 'chara'],
  LOCATION: [
    'places',
    'location',
    '地名',
    '施設',
    '場所',
    'place',
    'geo',
    'geography',
  ],
  PLOT: ['plot', '構成', 'プロット', '案', 'timeline', '時間軸', '年表'],
};

/**
 * メタデータのカテゴリ定義
 */
export const METADATA_CATEGORIES = {
  CHARACTER: 'character',
  LOCATION: 'location',
  PLOT: 'plot',
} as const;
