import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDocument } from '../../contexts/DocumentContext';
import './NovelNavigator.css';

interface FileNode {
  name: string;
  isDirectory: boolean;
  path: string;
  documentType?: string;
}

interface NovelNavigatorProps {
  activePath: string | null;
}

export default function NovelNavigator({ activePath }: NovelNavigatorProps) {
  const { openDocument } = useDocument();
  const [prevNovel, setPrevNovel] = useState<FileNode | null>(null);
  const [nextNovel, setNextNovel] = useState<FileNode | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (activePath) {
      const loadSiblings = async () => {
        try {
          const lastSep = Math.max(
            activePath.lastIndexOf('/'),
            activePath.lastIndexOf('\\'),
          );
          // If no separator, it's a file in the root, no siblings in a directory context
          if (lastSep === -1) {
            setPrevNovel(null);
            setNextNovel(null);
            return;
          }

          const dirPath = activePath.substring(0, lastSep);
          const currentFileName = activePath
            .substring(lastSep + 1)
            .toLowerCase();

          // fs:readDirectory を叩いて兄弟ファイルを取得
          const fileList: FileNode[] = await window.electron.ipcRenderer.invoke(
            'fs:readDirectory',
            dirPath,
          );

          // novel タイプのみ抽出＆ソート
          const novels = fileList
            .filter((f) => !f.isDirectory && f.documentType === 'novel')
            .sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { numeric: true }),
            );

          if (!isMounted) return;

          const currentIndex = novels.findIndex(
            (n) => n.name.toLowerCase() === currentFileName,
          );

          if (currentIndex !== -1) {
            setPrevNovel(currentIndex > 0 ? novels[currentIndex - 1] : null);
            setNextNovel(
              currentIndex < novels.length - 1
                ? novels[currentIndex + 1]
                : null,
            );
          } else {
            setPrevNovel(null);
            setNextNovel(null);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed to load sibling novels:', err);
        }
      };

      loadSiblings();
    } else {
      setPrevNovel(null);
      setNextNovel(null);
    }

    return () => {
      isMounted = false;
    };
  }, [activePath]);

  if (!activePath || (!prevNovel && !nextNovel)) {
    return null;
  }

  const getTitle = (filename: string) => {
    const dotIndex = filename.lastIndexOf('.');
    return dotIndex > 0 ? filename.substring(0, dotIndex) : filename;
  };

  const handleNavigate = (targetPath: string) => {
    try {
      openDocument(targetPath);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to navigate:', err);
    }
  };
  return (
    <div className="novel-navigator">
      <div className="nav-button-container prev">
        {prevNovel && (
          <button
            type="button"
            className="nav-button"
            onClick={() => {
              handleNavigate(prevNovel.path);
            }}
            title={prevNovel.name}
          >
            <ChevronLeft size={16} />
            <span className="nav-title truncate">
              {getTitle(prevNovel.name)}
            </span>
          </button>
        )}
      </div>
      <div className="nav-button-container next">
        {nextNovel && (
          <button
            type="button"
            className="nav-button"
            onClick={() => {
              handleNavigate(nextNovel.path);
            }}
            title={nextNovel.name}
          >
            <span className="nav-title truncate">
              {getTitle(nextNovel.name)}
            </span>
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
