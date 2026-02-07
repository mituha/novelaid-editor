import React from 'react';
import { SidePane } from '../Common/SidePane';

interface RightPaneProps {
  activeContent?: string;
  activePath?: string | null;
}

export const RightPane: React.FC<RightPaneProps> = (props) => {
  return <SidePane location="right" componentProps={props} />;
};
