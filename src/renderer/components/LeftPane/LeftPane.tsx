import React from 'react';
import { SidePane } from '../Common/SidePane';

interface LeftPaneProps {
  // 共通のプロパティがあれば定義するが、現在は不要
}

export const LeftPane: React.FC<LeftPaneProps> = () => {
  return <SidePane location="left" />;
};
