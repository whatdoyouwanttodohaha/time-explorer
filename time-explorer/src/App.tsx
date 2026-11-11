import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EntryKind } from './types';
import { ENTRIES, ENTRY_BY_ID } from './data/entries';
import { FULL_VIEW, type View, clampView, toYear, viewAround, windowFor } from './lib/time';
import { Header } from './components/Header';
import { Timeline } from './components/Timeline';
import { Overview } from './components/Overview';
import { WorldPanel } from './components/WorldPanel';
import { DetailDrawer } from './components/DetailDrawer';
import { SearchDialog } from './components/SearchDialog';
import { Legend } from './components/Legend';

const ALL_KINDS: EntryKind[] = ['event', 'person', 'phenomenon'];
const DEFAULT_YEAR = 1450;

function readHash(): { year: number; entry: string | null } {
  const params = new URLSearchParams(location.hash.slice(1));
  const entry = params.get('e');
  const y = Number(params.get('y'));
  if (entry && ENTRY_BY_ID[entry]) return { year: ENTRY_BY_ID[entry].year, entry };
  return { year: Number.isFinite(y) && y !== 0 ? toYear(y) : DEFAULT_YEAR, entry: null };
}

export default function App() {
  const initial = useMemo(readHash, []);
  const [year, setYear] = useState(initial.year);
  const [selectedId, setSelectedId] = useState<string | null>(initial.entry);
  const [view, setView] = useState<View>(() => (initial.entry ? viewAround(initial.year, 600) : FULL_VIEW));
  const [kinds, setKinds] = useState<Set<EntryKind>>(() => new Set(ALL_KINDS));
  const [searchOpen, setSearchOpen] = useState(false);

  const viewRef = useRef(view);
  viewRef.current = view;
  const animRef = useRef(0);

  /** 화면 범위를 부드럽게 옮긴다. */
  const animateTo = useCallback((target: View) => {
    cancelAnimationFrame(animRef.current);
    const from = viewRef.current;
    const to = clampView(target);
    const t0 = performance.now();
    const dur = 420;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const k = 1 - Math.pow(1 - t, 3);
      // 줌 정도를 로그 스케일로 보간해야 확대/축소가 자연스럽다.
      const s0 = from.end - from.start;
      const s1 = to.end - to.start;
      const span = Math.exp(Math.log(s0) + (Math.log(s1) - Math.log(s0)) * k);
      const c0 = (from.start + from.end) / 2;
      const c1 = (to.start + to.end) / 2;
      const c = c0 + (c1 - c0) * k;
      setView({ start: c - span / 2, end: c + span / 2 });
      if (t < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }, []);

  const changeView = useCallback((v: View) => {
    cancelAnimationFrame(animRef.current);
    setView(clampView(v));
  }, []);

  const goToYear = useCallback(
    (y: number, opts: { zoomSpan?: number } = {}) => {
      const target = toYear(y);
      setYear(target);
      const v = viewRef.current;
      const span = opts.zoomSpan ?? v.end - v.start;
      const margin = (v.end - v.start) * 0.08;
      if (opts.zoomSpan || target < v.start + margin || target > v.end - margin) {
        animateTo(viewAround(target, span));
      }
    },
    [animateTo],
  );

  const selectEntry = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (id) {
        const e = ENTRY_BY_ID[id];
        const span = viewRef.current.end - viewRef.current.start;
        goToYear(e.year, span > 1500 ? { zoomSpan: 600 } : {});
      }
    },
    [goToYear],
  );

  const visibleEntries = useMemo(() => ENTRIES.filter((e) => kinds.has(e.kind)), [kinds]);

  const jumpToNeighbor = useCallback(
    (dir: 1 | -1) => {
      const list = dir === 1 ? visibleEntries : [...visibleEntries].reverse();
      const next = list.find((e) => (dir === 1 ? e.year > year : e.year < year));
      if (next) selectEntry(next.id);
    },
    [visibleEntries, year, selectEntry],
  );

  const randomYear = useCallback(() => {
    const e = visibleEntries[Math.floor(Math.random() * visibleEntries.length)];
    if (e) {
      setSelectedId(null);
      goToYear(e.year, { zoomSpan: 400 });
    }
  }, [visibleEntries, goToYear]);

  const zoomTo = useCallback((span: number) => animateTo(viewAround(year, span)), [animateTo, year]);

  // URL 해시에 현재 위치 기록 (공유 가능한 링크)
  useEffect(() => {
    const hash = selectedId ? `e=${selectedId}` : `y=${year}`;
    history.replaceState(null, '', `#${hash}`);
  }, [year, selectedId]);

  // 주소창에서 해시를 직접 바꾼 경우 (replaceState는 이 이벤트를 일으키지 않는다)
  useEffect(() => {
    const onHash = () => {
      const h = readHash();
      if (h.entry) selectEntry(h.entry);
      else {
        setSelectedId(null);
        goToYear(h.year);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [selectEntry, goToYear]);

  // 키보드 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
        return;
      }
      const target = e.target as HTMLElement;
      if (searchOpen || target.closest('input, textarea, [contenteditable]')) return;
      const step = Math.max(1, Math.round(windowFor(viewRef.current) / 2));
      switch (e.key) {
        case '/':
          e.preventDefault();
          setSearchOpen(true);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goToYear(year - step * (e.shiftKey ? 10 : 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToYear(year + step * (e.shiftKey ? 10 : 1));
          break;
        case '[':
          jumpToNeighbor(-1);
          break;
        case ']':
          jumpToNeighbor(1);
          break;
        case '+':
        case '=':
          zoomTo((viewRef.current.end - viewRef.current.start) / 2);
          break;
        case '-':
          zoomTo((viewRef.current.end - viewRef.current.start) * 2);
          break;
        case 'Escape':
          setSelectedId(null);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen, year, goToYear, jumpToNeighbor, zoomTo]);

  const toggleKind = (k: EntryKind) =>
    setKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k) && next.size > 1) next.delete(k);
      else next.add(k);
      return next;
    });

  const span = view.end - view.start;

  return (
    <div className="app">
      <Header
        year={year}
        onSearch={() => setSearchOpen(true)}
        onRandom={randomYear}
      />

      <main className="main">
        <div className="toolbar">
          <div className="chip-group" role="group" aria-label="표시할 항목">
            {ALL_KINDS.map((k) => (
              <button
                key={k}
                className={`chip chip--${k}`}
                aria-pressed={kinds.has(k)}
                onClick={() => toggleKind(k)}
              >
                <span className={`mark mark--${k}`} aria-hidden />
                {k === 'event' ? '사건' : k === 'person' ? '인물' : '자연현상'}
                <span className="chip-count">{ENTRIES.filter((e) => e.kind === k).length}</span>
              </button>
            ))}
          </div>
          <div className="chip-group" role="group" aria-label="보기 범위">
            {[
              { label: '전체', span: FULL_VIEW.end - FULL_VIEW.start },
              { label: '1000년', span: 1000 },
              { label: '200년', span: 200 },
              { label: '50년', span: 50 },
            ].map((z) => (
              <button
                key={z.label}
                className="chip"
                aria-pressed={Math.abs(span - z.span) / z.span < 0.06}
                onClick={() => zoomTo(z.span)}
              >
                {z.label}
              </button>
            ))}
          </div>
        </div>

        <Timeline
          view={view}
          year={year}
          entries={visibleEntries}
          selectedId={selectedId}
          onViewChange={changeView}
          onYearChange={(y) => setYear(toYear(y))}
          onSelect={selectEntry}
        />
        <Overview view={view} year={year} entries={visibleEntries} onViewChange={animateTo} onDragView={changeView} />
        <Legend />

        <WorldPanel
          year={year}
          window={windowFor(view)}
          entries={visibleEntries}
          onSelect={selectEntry}
          onPrev={() => jumpToNeighbor(-1)}
          onNext={() => jumpToNeighbor(1)}
        />
      </main>

      <DetailDrawer
        entry={selectedId ? ENTRY_BY_ID[selectedId] : null}
        entries={visibleEntries}
        onClose={() => setSelectedId(null)}
        onSelect={selectEntry}
      />

      {searchOpen && (
        <SearchDialog
          onClose={() => setSearchOpen(false)}
          onPickEntry={(id) => {
            setSearchOpen(false);
            selectEntry(id);
          }}
          onPickYear={(y, s) => {
            setSearchOpen(false);
            setSelectedId(null);
            goToYear(y, { zoomSpan: s });
          }}
        />
      )}
    </div>
  );
}
