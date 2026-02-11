import React from 'react';
import { SidePane } from '../Common/SidePane';

interface LeftPaneProps {
  onFileSelect: (path: string, data: any) => void;
  onProjectOpened: (path: string) => void;
  onOpenDiff?: (path: string, staged: boolean) => void;
  [key: string]: any;
}

export const LeftPane: React.FC<LeftPaneProps> = (props) => {
  return <SidePane location="left" componentProps={props} />;
};
