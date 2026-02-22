import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useMetadata } from '../contexts/MetadataContext';
import { PERSONAS, Persona } from '../../common/constants/personas';

export interface DynamicPersona extends Persona {
  path: string;
  metadata: Record<string, any>;
}

export function usePersonas() {
  const { projectPath } = useSettings();
  const { isScanning, scanProgress } = useMetadata();
  const [dynamicPersonas, setDynamicPersonas] = useState<DynamicPersona[]>([]);

  const fetchDynamicPersonas = useCallback(async () => {
    try {
      const results = await window.electron.metadata.queryChatEnabled();
      const mapped: DynamicPersona[] = results.map((entry: any) => {
        const { metadata, path: p } = entry;
        const id =
          metadata.id || metadata.name || p.split(/[/\\]/).pop()!.split('.')[0];
        return {
          id,
          name: metadata.name || id,
          systemPrompt: metadata.chat?.persona || '',
          icon: metadata.icon || { type: 'lucide', value: 'User' },
          isDynamic: true,
          filePath: p,
          path: p,
          metadata,
        };
      });
      setDynamicPersonas(mapped);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch dynamic personas', err);
    }
  }, []);

  useEffect(() => {
    fetchDynamicPersonas();
    const cleanup = window.electron.fs.onFileChange(() => {
      fetchDynamicPersonas();
    });
    return () => cleanup();
  }, [fetchDynamicPersonas, projectPath]);

  // Re-fetch on scan progress or completion
  useEffect(() => {
    if (!isScanning || scanProgress === 100) {
      fetchDynamicPersonas();
    }
  }, [isScanning, scanProgress, fetchDynamicPersonas]);

  // Clear dynamic personas when project changes
  useEffect(() => {
    setDynamicPersonas([]);
  }, [projectPath]);

  const allPersonas = useMemo(
    () => [...PERSONAS, ...dynamicPersonas],
    [dynamicPersonas],
  );

  return {
    allPersonas,
    staticPersonas: PERSONAS,
    dynamicPersonas,
    refresh: fetchDynamicPersonas,
  };
}
