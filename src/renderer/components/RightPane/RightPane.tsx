import React from 'react';
import { SidePane } from '../Common/SidePane';
import { useDocument } from '../../contexts/DocumentContext';

export default function RightPane() {
  const {
    documents,
    activeTabPath,
    updateMetadata,
    leftActivePath,
    rightActivePath,
    leftTabs,
    rightTabs,
    openDocument,
    openWebBrowser,
  } = useDocument();

  const activeDoc = activeTabPath ? documents[activeTabPath] : null;

  const componentProps = {
    onFileSelect: (path: string) => openDocument(path, {}),
    activeContent: activeDoc?.content || '',
    activePath: activeTabPath,
    metadata: activeDoc?.metadata,
    onMetadataChange: (metadata: Record<string, any>) =>
      activeTabPath && updateMetadata(activeTabPath, metadata),
    onOpenWebBrowser: openWebBrowser,
    leftActivePath,
    rightActivePath,
    leftTabs,
    rightTabs,
    documents,
  };

  return <SidePane location="right" componentProps={componentProps} />;
}
