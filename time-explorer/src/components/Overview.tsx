import { useMemo, useRef } from 'react';
import type { Entry } from '../types';
import { ERAS } from '../data/tracks';
import { FULL_VIEW, type View } from '../lib/time';

const BUCKET = 50;

interface Props {
  view: View;
  year: number;
  entries: Entry[];
  onViewChange: (v: View) => void;
  onDragView: (v: View) => void;
}

/** 6,000년 전체를 한 줄로 보여주는 미니맵. 막대 높이는 50년 단위 기록 밀도. */
export function Overview({ view, year, entries, onViewChange, onDragView }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const full = FULL_VIEW.end - FULL_VIEW.start;
  const pct = (y: number) => ((y - FULL_VIEW.start) / full) * 100;

  const buckets = useMemo(() => {
    const map = new Map<number, number>();
    for (const e of entries) {
      const b = Math.floor(e.year / BUCKET) * BUCKET;
      map.set(b, (map.get(b) ?? 0) + e.importance);
    }
    const max = Math.max(1, ...map.values());
    return [...map].map(([start, n]) => ({ start, h: n / max }));
  }, [entries]);

  const centerAt = (clientX: number, animate: boolean) => {
    const rect = ref.current!.getBoundingClientRect();
    const c = FULL_VIEW.start + ((clientX - rect.left) / rect.width) * full;
    const s = view.end - view.start;
    (animate ? onViewChange : onDragView)({ start: c - s / 2, end: c + s / 2 });
  };

  return (
    <div
      ref={ref}
      className="overview"
      role="slider"
      aria-label="전체 연표에서 보는 범위"
      aria-valuemin={FULL_VIEW.start}
      aria-valuemax={FULL_VIEW.end}
      aria-valuenow={Math.round((view.start + view.end) / 2)}
      onPointerDown={(e) => {
        dragging.current = true;
        ref.current!.setPointerCapture(e.pointerId);
        centerAt(e.clientX, true);
      }}
      onPointerMove={(e) => dragging.current && centerAt(e.clientX, false)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      {ERAS.map((era, i) => (
        <div
          key={era.id}
          className={`ov-era${i % 2 ? ' ov-era--alt' : ''}`}
          style={{ left: `${pct(era.start)}%`, width: `${pct(era.end) - pct(era.start)}%` }}
        />
      ))}
      {buckets.map((b) => (
        <div
          key={b.start}
          className="ov-bar"
          style={{ left: `${pct(b.start)}%`, width: `${(BUCKET / full) * 100}%`, height: `${12 + b.h * 78}%` }}
        />
      ))}
      <div className="ov-cursor" style={{ left: `${pct(year)}%` }} />
      <div
        className="ov-window"
        style={{ left: `${pct(view.start)}%`, width: `max(4px, ${pct(view.end) - pct(view.start)}%)` }}
      />
      <span className="ov-label ov-label--start">기원전 4000</span>
      <span className="ov-label ov-label--end">현재</span>
    </div>
  );
}
