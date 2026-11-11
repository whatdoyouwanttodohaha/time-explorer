import { useEffect, useMemo, useRef, useState } from 'react';
import { ENTRIES } from '../data/entries';
import { TRACKS, TRACK_BY_ID } from '../data/tracks';
import { formatRange, formatYear, toYear } from '../lib/time';

interface Props {
  onClose: () => void;
  onPickEntry: (id: string) => void;
  onPickYear: (year: number, span?: number) => void;
}

type Result =
  | { kind: 'year'; key: string; year: number; label: string }
  | { kind: 'entry'; key: string; id: string; label: string; sub: string; color: string }
  | { kind: 'period'; key: string; year: number; span: number; label: string; sub: string; color: string };

/** "기원전 500", "BC500", "-500", "1443년" 같은 입력을 연도로 해석한다. */
function parseYear(q: string): number | null {
  const m = q.replace(/\s+/g, '').match(/^(기원전|BC|BCE|B\.C\.|-)?(\d{1,4})년?(BC|BCE)?$/i);
  if (!m) return null;
  const n = Number(m[2]);
  if (!n) return null;
  return m[1] || m[3] ? -n : n;
}

const PERIODS = TRACKS.flatMap((t) => t.periods.map((p) => ({ p, t })));

export function SearchDialog({ onClose, onPickEntry, onPickYear }: Props) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const results = useMemo<Result[]>(() => {
    const query = q.trim().toLowerCase();
    if (!query) {
      return ENTRIES.filter((e) => e.importance === 3)
        .slice(0, 12)
        .map((e) => ({
          kind: 'entry',
          key: e.id,
          id: e.id,
          label: e.title,
          sub: `${formatYear(e.year)} · ${TRACK_BY_ID[e.track].name}`,
          color: TRACK_BY_ID[e.track].color,
        }));
    }
    const out: Result[] = [];
    const y = parseYear(query);
    if (y !== null) out.push({ kind: 'year', key: `y${y}`, year: toYear(y), label: `${formatYear(toYear(y))}로 이동` });
    for (const e of ENTRIES) {
      const hay = `${e.title} ${e.summary}`.toLowerCase();
      if (hay.includes(query)) {
        out.push({
          kind: 'entry',
          key: e.id,
          id: e.id,
          label: e.title,
          sub: `${formatYear(e.year)} · ${TRACK_BY_ID[e.track].name}`,
          color: TRACK_BY_ID[e.track].color,
        });
      }
    }
    for (const { p, t } of PERIODS) {
      if (p.name.toLowerCase().includes(query)) {
        out.push({
          kind: 'period',
          key: p.id,
          year: Math.round((p.start + p.end) / 2) || 1,
          span: Math.max(60, (p.end - p.start) * 1.4),
          label: p.name,
          sub: `${t.name} · ${formatRange(p.start, p.end)}`,
          color: t.color,
        });
      }
    }
    // 제목에 직접 들어간 결과를 먼저
    return out
      .map((r, i) => ({ r, i, s: r.kind === 'year' ? -1 : r.label.toLowerCase().includes(query) ? 0 : 1 }))
      .sort((a, b) => a.s - b.s || a.i - b.i)
      .map(({ r }) => r)
      .slice(0, 40);
  }, [q]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (r: Result) => {
    if (r.kind === 'entry') onPickEntry(r.id);
    else if (r.kind === 'period') onPickYear(r.year, r.span);
    else onPickYear(r.year, 200);
  };

  return (
    <div className="dialog-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="검색">
        <div className="dialog-input-wrap">
          <svg viewBox="0 0 20 20" aria-hidden>
            <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M13.2 13.2 17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className="dialog-input"
            placeholder="사건, 인물, 왕조 또는 연도 (예: 훈민정음, 로마, 기원전 500)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              // 한글 조합 중의 Enter·화살표는 IME 몫
              if (e.nativeEvent.isComposing) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter' && results[active]) {
                pick(results[active]);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            aria-controls="search-results"
            aria-activedescendant={results[active] ? `sr-${results[active].key}` : undefined}
          />
          <kbd>esc</kbd>
        </div>
        {!q && <p className="dialog-caption">핵심 사건</p>}
        <ul ref={listRef} id="search-results" className="dialog-list" role="listbox">
          {results.length === 0 && <li className="dialog-empty">“{q}”에 맞는 결과가 없어요.</li>}
          {results.map((r, i) => (
            <li
              key={r.key}
              id={`sr-${r.key}`}
              role="option"
              aria-selected={i === active}
              className="dialog-item"
              onPointerEnter={() => setActive(i)}
              onClick={() => pick(r)}
            >
              {r.kind === 'year' ? (
                <span className="dialog-item-icon">→</span>
              ) : (
                <span className={`tl-swatch${r.kind === 'period' ? ' tl-swatch--bar' : ''}`} style={{ background: r.color }} />
              )}
              <span className="dialog-item-label">{r.label}</span>
              {r.kind !== 'year' && <span className="dialog-item-sub">{r.sub}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
