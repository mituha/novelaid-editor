import React, { useMemo } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import * as Icons from 'lucide-react';
import yaml from 'js-yaml';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MarkdownPlugin } from '../types';

/**
 * 地図マーカーの定義
 */
interface MapMarker {
  lat: number;
  long: number;
  type?: string;
  link?: string;
  description?: string;
}

/**
 * 文字列から Lucide アイコンを取得するヘルパー
 */
const getIcon = (type?: string) => {
  if (!type || type === 'default') return Icons.MapPin;

  // kebab-case, snake_case を PascalCase に変換する (map-pin -> MapPin)
  const name = type
    .split(/[-_ ]+/)
    .map(
      (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = (Icons as any)[name];
  return IconComponent || Icons.MapPin;
};

/**
 * 地図を表示するコンポーネント
 */
const MapComponent: React.FC<{ value: string }> = ({ value }) => {
  const config = useMemo(() => {
    try {
      return (yaml.load(value) as any) || {};
    } catch (e) {
      return {};
    }
  }, [value]);

  const lat = parseFloat(config.lat) || 0;
  const lng = parseFloat(config.long || config.lng) || 0;
  const zoom = parseFloat(config.defaultZoom || config.zoom) || 12;
  const height =
    typeof config.height === 'number'
      ? `${config.height}px`
      : config.height || '400px';
  const width =
    typeof config.width === 'number'
      ? `${config.width}%`
      : config.width || '100%';

  // マーカーの抽出
  const markers: MapMarker[] = useMemo(() => {
    const rawMarker = config.marker || config.markers || [];
    let rawList: any[] = [];

    if (Array.isArray(rawMarker)) {
      if (rawMarker.length === 0) {
        rawList = [];
      } else if (
        Array.isArray(rawMarker[0]) ||
        (typeof rawMarker[0] === 'object' && rawMarker[0] !== null)
      ) {
        // マーカーのリスト [[...], [...]] または [{...}, {...}]
        rawList = rawMarker;
      } else if (typeof rawMarker[0] === 'string' && rawMarker[0].includes(',')) {
        // "type, lat, long" などの文字列の配列（マーカーリスト）
        rawList = rawMarker;
      } else {
        // [type, lat, long] などの単一マーカーを構成する配列とみなす
        rawList = [rawMarker];
      }
    } else if (rawMarker) {
      // 単一の文字列または単一のオブジェクト
      rawList = [rawMarker];
    }

    const result = rawList
      .map((m: any): MapMarker | null => {
        if (!m) return null;
        // 文字列形式: "type, lat, long, link, desc"
        if (typeof m === 'string') {
          const parts = m.split(',').map((s) => s.trim());
          if (parts.length < 2) return null;
          const hasType = isNaN(parseFloat(parts[0]));
          return {
            type: hasType ? parts[0] : 'default',
            lat: parseFloat(hasType ? parts[1] : parts[0]) || 0,
            long: parseFloat(hasType ? parts[2] : parts[1]) || 0,
            link: hasType ? parts[3] : parts[2],
          };
        }
        // 配列形式
        if (Array.isArray(m)) {
          if (m.length < 2) return null;
          const hasType = isNaN(parseFloat(String(m[0])));
          return {
            type: hasType ? String(m[0]) : 'default',
            lat: parseFloat(String(hasType ? m[1] : m[0])) || 0,
            long: parseFloat(String(hasType ? m[2] : m[1])) || 0,
            link: hasType ? String(m[3] || '') : String(m[2] || ''),
          };
        }
        // オブジェクト形式
        if (typeof m === 'object') {
          const mLat = parseFloat(m.lat ?? m.latitude);
          const mLng = parseFloat(m.long ?? m.lng ?? m.longitude);
          if (isNaN(mLat) || isNaN(mLng)) return null;
          return {
            type: m.type ? String(m.type) : 'default',
            lat: mLat,
            long: mLng,
            link: m.link ? String(m.link) : undefined,
            description: m.description ? String(m.description) : undefined,
          };
        }
        return null;
      })
      .filter((m): m is MapMarker => m !== null);

    return result;
  }, [config]);

  // シンプルな OSM スタイル
  const mapStyle = {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
      },
    ],
  };

  return (
    <div
      key={`${lat}-${lng}-${zoom}-${height}-${width}`}
      className="novelaid-map-container"
      style={{
        height,
        width,
        margin: '1.5em 0',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        border: '1px solid var(--border-color, #ccc)',
        position: 'relative',
        backgroundColor: '#f0f0f0', // ロード中の背景色
      }}
    >
      <Map
        initialViewState={{
          longitude: lng,
          latitude: lat,
          zoom: zoom,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle as any}
      >
        {markers.map((marker, index) => {
          const Icon = getIcon(marker.type);
          return (
            <Marker
              key={`marker-${index}-${marker.lat}-${marker.long}`}
              longitude={marker.long}
              latitude={marker.lat}
              anchor="bottom"
            >
              <div
                style={{
                  cursor: 'pointer',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                  zIndex: 10,
                }}
                title={marker.description || marker.type}
              >
                <Icon size={24} color="#e91e63" fill="#ffffff" />
              </div>
            </Marker>
          );
        })}
      </Map>
    </div>
  );
};

/**
 * 地図コードブロック用のプラグイン定義
 */
export const mapPlugin: MarkdownPlugin = {
  name: 'map',
  codeProcessors: [
    { language: 'carto-paw', component: MapComponent },
    { language: 'carto-pow', component: MapComponent },
    { language: 'map', component: MapComponent },
    { language: 'leaflet', component: MapComponent },
  ],
};
