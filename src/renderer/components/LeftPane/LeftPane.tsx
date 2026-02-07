import React from 'react';
import { SidePane } from '../Common/SidePane';

interface LeftPaneProps {
  onFileSelect: (path: string, content: string) => void;
  onProjectOpened: (path: string) => void;
}

export const LeftPane: React.FC<LeftPaneProps> = (props) => {
  return <SidePane location="left" componentProps={props} />;
};
