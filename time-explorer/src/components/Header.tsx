import { useEffect, useState } from 'react';
import { formatYear } from '../lib/time';

type Theme = 'light' | 'dark';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('te-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* 저장소를 못 쓰는 환경 */
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface Props {
  year: number;
  onSearch: () => void;
  onRandom: () => void;
}

export function Header({ year, onSearch, onRandom }: Props) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('te-theme', theme);
    } catch {
      /* 무시 */
    }
  }, [theme]);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="header">
      <div className="brand">
        <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden>
          <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M16 7v9l6 4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M3 16h4M25 16h4" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        <div>
          <h1 className="brand-name">시간 탐색기</h1>
          <p className="brand-tag">같은 해, 다른 세계</p>
        </div>
      </div>

      <div className="header-year" aria-live="polite">
        <span className="header-year-label">지금 보는 해</span>
        <span className="header-year-value">{formatYear(year)}</span>
      </div>

      <div className="header-actions">
        <button className="btn btn--search" onClick={onSearch}>
          <svg viewBox="0 0 20 20" aria-hidden>
            <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M13.2 13.2 17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span className="btn-text">사건·연도 검색</span>
          <kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
        <button className="btn btn--icon" onClick={onRandom} title="무작위 사건으로 이동" aria-label="무작위 사건으로 이동">
          <svg viewBox="0 0 20 20" aria-hidden>
            <rect x="3" y="3" width="14" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="7" cy="7" r="1.3" fill="currentColor" />
            <circle cx="13" cy="13" r="1.3" fill="currentColor" />
            <circle cx="10" cy="10" r="1.3" fill="currentColor" />
          </svg>
        </button>
        <button
          className="btn btn--icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? '밝은 화면' : '어두운 화면'}
          aria-label={theme === 'dark' ? '밝은 화면으로 바꾸기' : '어두운 화면으로 바꾸기'}
        >
          {theme === 'dark' ? (
            <svg viewBox="0 0 20 20" aria-hidden>
              <circle cx="10" cy="10" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" aria-hidden>
              <path d="M16 12.5A6.5 6.5 0 0 1 7.5 4a6.5 6.5 0 1 0 8.5 8.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
