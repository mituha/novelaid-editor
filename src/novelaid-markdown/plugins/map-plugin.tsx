import React, { useMemo } from 'react';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MarkdownPlugin } from '../types';

/**
 * 地図を表示するコンポーネント
 */
const MapComponent: React.FC<{ value: string }> = ({ value }) => {
  const config = useMemo(() => {
    const data: any = {};
    const lines = value.split('\n');
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex !== -1) {
        const key = trimmed.substring(0, colonIndex).trim().toLowerCase();
        const val = trimmed.substring(colonIndex + 1).split('#')[0].trim();
        data[key] = val;
      }
    });
    return data;
  }, [value]);

  const lat = parseFloat(config.lat) || 0;
  const lng = parseFloat(config.long || config.lng) || 0;
  const scale = parseFloat(config.scale || config.zoom) || 12;
  const height = config.height || '400px';
  const width = config.width || '100%';

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
          zoom: scale,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle as any}
      />
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
