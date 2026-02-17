import React, { useState, useCallback } from 'react';
import { Search, ChevronRight, ChevronDown, FileText } from 'lucide-react';
import { Panel } from '../../types/panel';
import './SearchPanel.css';

interface SearchMatch {
  line: number;
  text: string;
  index: number;
}

interface SearchResult {
  filePath: string;
  matches: SearchMatch[];
}

interface SearchPanelProps {
  onFileSelect: (path: string, data: any) => void;
  [key: string]: any;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ onFileSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(
    new Set<string>(),
  );

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setResults([]);
    setExpandedFiles(new Set());

    try {
      // We use an empty string for rootPath to let the main process use its tracked project path if available,
      // OR we might need to update the IPC to use the active project.
      const res = await window.electron.ipcRenderer.invoke(
        'search:project',
        query,
        '',
      ); // Empty rootPath
      setResults(res);

      // Auto-expand all if results are few
      if (res.length < 10) {
        const allPaths = new Set<string>(res.map((r: SearchResult) => r.filePath));
        setExpandedFiles(allPaths);
      }
    } catch (err) {
      // Ignore errors
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  const toggleFile = (filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set<string>(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  const handleMatchClick = async (filePath: string, line: number, index: number) => {
    try {
      // Read file content first
      const data = await window.electron.ipcRenderer.invoke(
        'fs:readDocument',
        filePath,
      );

      // onFileSelect will open the tab
      // line is the relative line number from body (1-based)
      onFileSelect(filePath, {
        ...data,
        initialLine: line,
        initialColumn: index + 1, // Monaco is 1-based
        searchQuery: query,
      });
    } catch (err) {
      // Ignore errors
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  return (
    <div className="search-panel">
      <div className="search-input-container">
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <div className="search-icon">
            {isSearching ? (
              <div className="loading-spinner" />
            ) : (
              <Search size={14} />
            )}
          </div>
        </div>
      </div>

      <div className="search-results">
        {results.length === 0 && !isSearching && query && (
          <div className="search-status">No results found.</div>
        )}

        {results.map((result) => {
          const isExpanded = expandedFiles.has(result.filePath);
          const fileName = result.filePath.split(/[/\\]/).pop();

          return (
            <div key={result.filePath} className="search-file-group">
              <div
                className="search-file-header"
                role="button"
                tabIndex={0}
                onClick={() => toggleFile(result.filePath)}
                onKeyDown={(e) => handleKeyDown(e, () => toggleFile(result.filePath))}
              >
                <div className="search-file-icon">
                  {isExpanded ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </div>
                <FileText size={14} style={{ marginRight: 6, opacity: 0.7 }} />
                <span className="search-file-name" title={result.filePath}>
                  {fileName}
                </span>
                <span className="search-file-count">{result.matches.length}</span>
              </div>

              {isExpanded && (
                <ul className="search-matches">
                  {result.matches.map((match, idx) => (
                    <li
                      key={`${result.filePath}-${idx}`}
                      className="search-match-item"
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        handleMatchClick(result.filePath, match.line, match.index)
                      }
                      onKeyDown={(e) => handleKeyDown(e, () => handleMatchClick(result.filePath, match.line, match.index))}
                    >
                      <span className="line-number">{match.line}:</span>
                      <span className="match-text" title={match.text}>
                        {match.text
                          .split(new RegExp(`(${query})`, 'gi'))
                          .map((part, i) =>
                            part.toLowerCase() === query.toLowerCase() ? (
                              <span
                                key={i}
                                className="search-match-highlight"
                              >
                                {part}
                              </span>
                            ) : (
                              part
                            ),
                          )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const searchPanelConfig: Panel = {
  id: 'search',
  title: '検索',
  icon: <Search size={24} strokeWidth={1.5} />,
  component: SearchPanel,
  defaultLocation: 'left',
};
