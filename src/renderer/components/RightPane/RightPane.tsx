import React from 'react';
import { SidePane } from '../Common/SidePane';

interface RightPaneProps {
  activeContent?: string;
  activePath?: string | null;
  metadata?: Record<string, any>;
  onMetadataChange?: (metadata: Record<string, any>) => void;
  [key: string]: any;
}

export const RightPane: React.FC<RightPaneProps> = (props) => {
  return <SidePane location="right" componentProps={props} />;
};
