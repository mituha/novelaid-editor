import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, ExternalLink } from 'lucide-react';
import './WebBrowser.css';

interface WebBrowserProps {
  initialUrl: string;
}

export default function WebBrowser({ initialUrl }: WebBrowserProps) {
  const [url, setUrl] = useState(initialUrl);
  const [inputValue, setInputValue] = useState(initialUrl);
  const webviewRef = useRef<any>(null);

  const handleGoBack = () => {
    if (webviewRef.current?.canGoBack()) {
      webviewRef.current.goBack();
    }
  };

  const handleGoForward = () => {
    if (webviewRef.current?.canGoForward()) {
      webviewRef.current.goForward();
    }
  };

  const handleReload = () => {
    webviewRef.current?.reload();
  };

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let targetUrl = inputValue;
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }
    setUrl(targetUrl);
    setInputValue(targetUrl);
  };

  const handleExternalOpen = () => {
    window.electron.ipcRenderer.invoke('dialog:confirm', 'ブラウザで開きますか？').then((confirmed) => {
      if (confirmed) {
        window.open(webviewRef.current?.getURL() || url, '_blank');
      }
    });
  };

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleDidNavigate = (event: any) => {
      setInputValue(event.url);
    };

    webview.addEventListener('did-navigate', handleDidNavigate);
    webview.addEventListener('did-navigate-in-page', handleDidNavigate);

    return () => {
      webview.removeEventListener('did-navigate', handleDidNavigate);
      webview.removeEventListener('did-navigate-in-page', handleDidNavigate);
    };
  }, []);

  return (
    <div className="web-browser">
      <div className="browser-toolbar">
        <div className="nav-buttons">
          <button type="button" onClick={handleGoBack} title="戻る">
            <ArrowLeft size={18} />
          </button>
          <button type="button" onClick={handleGoForward} title="進む">
            <ArrowRight size={18} />
          </button>
          <button type="button" onClick={handleReload} title="更新">
            <RotateCw size={18} />
          </button>
        </div>
        <form className="url-bar" onSubmit={handleNavigate}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="URLを入力..."
          />
        </form>
        <button
          type="button"
          onClick={handleExternalOpen}
          title="外部ブラウザで開く"
          className="external-link-btn"
        >
          <ExternalLink size={18} />
        </button>
      </div>
      <div className="webview-container">
        <webview
          ref={webviewRef}
          src={url}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}
