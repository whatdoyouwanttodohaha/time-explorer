import { useMemo } from 'react';
import type { Entry } from '../types';
import { TRACK_BY_ID } from '../data/tracks';
import { CERTAINTY_HINT, CERTAINTY_LABEL, KIND_LABEL, formatYear } from '../lib/time';

interface Props {
  entry: Entry | null;
  entries: Entry[];
  onClose: () => void;
  onSelect: (id: string) => void;
}

export function DetailDrawer({ entry, entries, onClose, onSelect }: Props) {
  // 다른 지역에서 시간상 가장 가까운 기록들
  const meanwhile = useMemo(() => {
    if (!entry) return [];
    // 기록이 촘촘한 근현대는 좁게, 고대는 넓게 찾는다.
    const range = entry.year > 1500 ? 60 : 150;
    return entries
      .filter((e) => e.track !== entry.track)
      .map((e) => ({ e, d: Math.abs(e.year - entry.year) }))
      .filter(({ d }) => d <= range)
      .sort((a, b) => a.d - b.d || b.e.importance - a.e.importance)
      .slice(0, 5)
      .map(({ e }) => e);
  }, [entry, entries]);

  const track = entry ? TRACK_BY_ID[entry.track] : null;
  // 시대가 겹치면(남송·금·서하, 히타이트·카시트 등) 제목이나 설명에 이름이 나오는 쪽을 먼저 고르고,
  // 없으면 가장 늦게 시작한 쪽을 고른다. 한 글자 이름(금, 요)은 본문과 헷갈리기 쉬워 비교에서 뺀다.
  const period = (() => {
    if (!entry || !track) return null;
    const inYear = track.periods.filter((p) => entry.year >= p.start && entry.year < p.end);
    const latest = (list: typeof inYear) =>
      list.reduce<(typeof inYear)[number] | null>((best, p) => (!best || p.start >= best.start ? p : best), null);
    const text = `${entry.title} ${entry.summary}`;
    const named = inYear.filter((p) => {
      const name = p.name.replace(/\s*\(.*?\)\s*/g, '').trim();
      return name.length >= 2 && text.includes(name);
    });
    return latest(named.length ? named : inYear);
  })();

  return (
    <aside className={`drawer${entry ? ' is-open' : ''}`} aria-hidden={!entry} aria-label="사건 정보">
      {entry && track && (
        <div className="drawer-inner" style={{ ['--c' as string]: track.color }}>
          <button className="btn btn--icon drawer-close" onClick={onClose} aria-label="닫기">
            <svg viewBox="0 0 20 20" aria-hidden>
              <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>

          <p className="drawer-meta">
            <span className="tl-swatch" style={{ background: track.color }} />
            {track.name}
            {period && <> · {period.name}</>}
          </p>
          <h2 className="drawer-title">{entry.title}</h2>
          <p className="drawer-year">{formatYear(entry.year)}</p>

          <div className="drawer-tags">
            <span className="tag">
              <span className={`mark mark--${entry.kind}`} aria-hidden />
              {KIND_LABEL[entry.kind]}
            </span>
            <span className={`tag tag--cert-${entry.certainty}`} title={CERTAINTY_HINT[entry.certainty]}>
              연대 {CERTAINTY_LABEL[entry.certainty]}
            </span>
          </div>

          <p className="drawer-summary">{entry.summary}</p>
          <p className="drawer-hint">{CERTAINTY_HINT[entry.certainty]}</p>

          {meanwhile.length > 0 && (
            <section className="drawer-section">
              <h3 className="drawer-section-title">같은 무렵, 다른 곳에서는</h3>
              <ul className="card-list">
                {meanwhile.map((e) => {
                  const t = TRACK_BY_ID[e.track];
                  const d = e.year - entry.year;
                  return (
                    <li key={e.id}>
                      <button className="card-entry" onClick={() => onSelect(e.id)}>
                        <span className="tl-swatch" style={{ background: t.color }} />
                        <span className="card-entry-title">
                          <span className="card-entry-track">{t.name}</span>
                          {e.title}
                        </span>
                        <span className="card-entry-year">
                          {d === 0 ? '같은 해' : d > 0 ? `${d}년 뒤` : `${-d}년 전`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </aside>
  );
}
