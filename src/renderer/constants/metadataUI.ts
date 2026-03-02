import { Users, MapPin, ScrollText, Bookmark } from 'lucide-react';
import { METADATA_TAGS } from '../../common/constants/metadata';

/**
 * メタデータカテゴリごとのUI定義（アイコン、タイトル、インテリセンス設定）
 */
export const METADATA_UI_DEFS = {
  CHARACTER: {
    id: 'characters',
    title: '登場人物',
    Icon: Users,
    tags: METADATA_TAGS.CHARACTER,
    monacoKindName: 'User',
    detail: '登場人物',
  },
  LOCATION: {
    id: 'locations',
    title: '地名・施設',
    Icon: MapPin,
    tags: METADATA_TAGS.LOCATION,
    monacoKindName: 'Map',
    detail: '地名・場所',
  },
  PLOT: {
    id: 'plots',
    title: 'プロット',
    Icon: ScrollText,
    tags: METADATA_TAGS.PLOT,
    monacoKindName: 'Reference',
    detail: 'プロット・構成',
  },
  GENERAL: {
    id: 'metadata-list',
    title: '収集一覧',
    Icon: Bookmark,
    tags: [],
    monacoKindName: 'Text',
    detail: 'メタデータ',
  },
} as const;

export type MetadataCategoryId = keyof typeof METADATA_UI_DEFS;
