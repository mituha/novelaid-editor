import React from 'react';

export type PanelLocation = 'left' | 'right' | 'bottom';

export interface Panel {
  id: string;
  title: string;
  icon: React.ReactNode;
  component: React.ComponentType<any>;
  defaultLocation?: PanelLocation;
}

export interface PanelRegistry {
  register: (panel: Panel) => void;
  getPanels: () => Panel[];
  getPanel: (id: string) => Panel | undefined;
}
