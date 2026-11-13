import type { Entry } from '../types';
import { TRACKS } from '../data/tracks';
import { RULERS } from '../data/rulers';
import { formatRange, formatYear } from '../lib/time';

interface Props {
  year: number;
  window: number;
  entries: Entry[];
  onSelect: (id: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

const MAX_PER_CARD = 4;

function relative(y: number, base: number): string {
  const d = y - base;
  if (d === 0) return '같은 해';
  return d > 0 ? `${d}년 뒤` : `${-d}년 전`;
}

/** 선택한 해를 기준으로 ±window년 안에 각 지역에서 일어난 일을 나란히 보여준다. */
export function WorldPanel({ year, window, entries, onSelect, onPrev, onNext }: Props) {
  const cards = TRACKS.map((track) => {
    const periods = track.periods.filter((p) => year >= p.start && year < p.end);
    const rulers = (RULERS[track.id] ?? []).flatMap((lane) =>
      lane.rulers.filter((r) => year >= r.start && year < r.end).map((r) => ({ lane, r })),
    );
    const near = entries
      .filter((e) => e.track === track.id && Math.abs(e.year - year) <= window)
      .sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year) || b.importance - a.importance);
    return { track, periods, rulers, near };
  });
  const total = cards.reduce((n, c) => n + c.near.length, 0);
  const activeCards = cards.filter((c) => c.periods.length || c.near.length);

  return (
    <section className="world" aria-labelledby="world-title">
      <div className="world-head">
        <div>
          <h2 id="world-title" className="world-title">
            그 무렵 세계는 <span className="world-year">{formatYear(year)}</span>
          </h2>
          <p className="world-sub">
            앞뒤 {window}년 사이 · 기록 {total}건
          </p>
        </div>
        <div className="world-nav">
          <button className="btn" onClick={onPrev} title="이전 사건 ([)">
            ← 이전 사건
          </button>
          <button className="btn" onClick={onNext} title="다음 사건 (])">
            다음 사건 →
          </button>
        </div>
      </div>

      <div className="world-grid">
        {activeCards.map(({ track, periods, rulers, near }) => (
          <article key={track.id} className="card" style={{ ['--c' as string]: track.color }}>
            <header className="card-head">
              <span className="tl-swatch" style={{ background: track.color }} />
              <h3 className="card-title">{track.name}</h3>
            </header>
            {periods.map((p) => (
              <p key={p.id} className="card-period">
                {p.name}
                <span className="card-period-range">{formatRange(p.start, p.end)}</span>
              </p>
            ))}
            {rulers.map(({ lane, r }) => (
              <p key={r.id} className="card-ruler">
                <span className="card-ruler-lane">{lane.name}</span>
                {r.name}
                <span className="card-period-range">{formatRange(r.start, r.end)}</span>
              </p>
            ))}
            {near.length > 0 ? (
              <ul className="card-list">
                {near.slice(0, MAX_PER_CARD).map((e) => (
                  <li key={e.id}>
                    <button className="card-entry" onClick={() => onSelect(e.id)}>
                      <span className={`mark mark--${e.kind} cert--${e.certainty}`} aria-hidden />
                      <span className="card-entry-title">{e.title}</span>
                      <span className="card-entry-year">{relative(e.year, year)}</span>
                    </button>
                  </li>
                ))}
                {near.length > MAX_PER_CARD && <li className="card-more">외 {near.length - MAX_PER_CARD}건</li>}
              </ul>
            ) : (
              <p className="card-empty">이 무렵 기록된 사건 없음</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
