import React, { useMemo } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import * as yaml from 'js-yaml';
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
 * 地図を表示するコンポーネント
 */
const MapComponent: React.FC<{ value: string }> = ({ value }) => {
  const config = useMemo(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (yaml.load(value) as any) || {};
    } catch (e) {
      console.error('YAML parse error:', e);
      return {};
    }
  }, [value]);

  const lat = parseFloat(config.lat) || 0;
  const lng = parseFloat(config.long || config.lng) || 0;
  const zoom = parseFloat(config.defaultZoom || config.zoom) || 12;
  const height = config.height || '400px';
  const width = config.width || '100%';

  // マーカーの抽出
  const markers: MapMarker[] = useMemo(() => {
    const rawMarker = config.marker || config.markers || [];
    const markerList = Array.isArray(rawMarker)
      ? Array.isArray(rawMarker[0]) || typeof rawMarker[0] === 'object'
        ? rawMarker
        : [rawMarker]
      : typeof rawMarker === 'string'
      ? [rawMarker]
      : [];

    return markerList
      .map((m: any) => {
        if (!m) return null;
        // カンマ区切りの文字列形式: "type, lat, long, link, desc"
        if (typeof m === 'string') {
          const parts = m.split(',').map((s) => s.trim());
          return {
            type: parts[0],
            lat: parseFloat(parts[1]) || 0,
            long: parseFloat(parts[2]) || 0,
            link: parts[3],
            description: parts[4],
          };
        }
        // 配列形式: [type, lat, long, link, desc]
        if (Array.isArray(m)) {
          return {
            type: String(m[0]),
            lat: parseFloat(m[1]) || 0,
            long: parseFloat(m[2]) || 0,
            link: m[3] ? String(m[3]) : undefined,
            description: m[4] ? String(m[4]) : undefined,
          };
        }
        // オブジェクト形式
        if (typeof m === 'object') {
          return {
            type: m.type,
            lat: parseFloat(m.lat) || 0,
            long: parseFloat(m.long || m.lng) || 0,
            link: m.link,
            description: m.description,
          };
        }
        return null;
      })
      .filter((m): m is MapMarker => m !== null);
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
      key={`${lat}-${lng}-${zoom}`}
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
        {markers.map((marker, index) => (
          <Marker
            key={index}
            longitude={marker.long}
            latitude={marker.lat}
            anchor="bottom"
          >
            <div
              style={{
                color: '#e91e63',
                cursor: 'pointer',
                fontSize: '24px',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
              }}
              title={marker.description || marker.type}
            >
              📍
            </div>
          </Marker>
        ))}
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
