import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Entry, Track } from '../types';
import { ERAS, TRACKS } from '../data/tracks';
import {
  type View,
  assignLanes,
  formatRange,
  formatTick,
  formatYear,
  ticks,
  windowFor,
  KIND_LABEL,
  CERTAINTY_LABEL,
} from '../lib/time';

const RULER_H = 30;
const ERA_H = 24;
const EVENT_H = 24;
const LANE_H = 20;
const LANE_GAP = 3;
const ROW_PAD = 7;

interface RowLayout {
  track: Track;
  top: number;
  height: number;
  lanes: Map<string, number>;
  eventsTop: number;
}

const ROWS: RowLayout[] = (() => {
  let top = RULER_H + ERA_H;
  return TRACKS.map((track) => {
    const { lanes, count } = assignLanes(track.periods);
    const laneCount = track.periods.length ? count : 0;
    const height = ROW_PAD * 2 + EVENT_H + laneCount * (LANE_H + LANE_GAP);
    const row = { track, top, height, lanes, eventsTop: top + ROW_PAD };
    top += height;
    return row;
  });
})();

export const TIMELINE_HEIGHT = ROWS[ROWS.length - 1].top + ROWS[ROWS.length - 1].height;

interface Props {
  view: View;
  year: number;
  entries: Entry[];
  selectedId: string | null;
  onViewChange: (v: View) => void;
  onYearChange: (y: number) => void;
  onSelect: (id: string) => void;
}

type LabelSide = 'right' | 'left';

/** 한글 라벨의 대략적인 픽셀 너비 (12px 기준) */
const labelWidth = (text: string) => text.length * 11.5 + 6;

export function Timeline({ view, year, entries, selectedId, onViewChange, onYearChange, onSelect }: Props) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const drag = useRef<{ x0: number; view0: View; moved: boolean; entryId?: string; pointerId: number } | null>(null);

  useLayoutEffect(() => {
    const el = plotRef.current!;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const span = view.end - view.start;
  const x = (y: number) => ((y - view.start) / span) * width;
  const yearAt = (px: number) => view.start + (px / width) * span;

  // 휠: ⌘/Ctrl(또는 트랙패드 핀치)로 확대·축소, 가로 스크롤로 이동. 세로 스크롤은 페이지에 양보한다.
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    const el = plotRef.current!;
    const onWheel = (e: WheelEvent) => {
      const v = viewRef.current;
      const s = v.end - v.start;
      const w = el.clientWidth;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const anchor = v.start + ((e.clientX - rect.left) / w) * s;
        const d = Math.max(-60, Math.min(60, e.deltaY));
        const k = Math.exp(d * 0.01);
        onViewChange({ start: anchor - (anchor - v.start) * k, end: anchor + (v.end - anchor) * k });
        return;
      }
      const dx = e.shiftKey ? e.deltaY : Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
      if (dx) {
        e.preventDefault();
        const dy = (dx / w) * s;
        onViewChange({ start: v.start + dy, end: v.end + dy });
      }
    };
    // 두 손가락일 때 브라우저가 페이지를 스크롤·확대하지 않게 막는다(iOS Safari는 gesture* 이벤트도 막아야 한다).
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    const onGesture = (e: Event) => e.preventDefault();
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('gesturestart', onGesture);
    el.addEventListener('gesturechange', onGesture);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('gesturestart', onGesture);
      el.removeEventListener('gesturechange', onGesture);
    };
  }, [onViewChange]);

  // 터치 두 손가락 핀치: 시작할 때 두 손가락 사이 중점의 연도를 고정하고, 손가락 간격에 반비례해 범위 폭을 바꾼다.
  const touches = useRef(new Map<number, number>());
  const pinch = useRef<{ view0: View; dist0: number; anchor: number } | null>(null);
  const startPinch = () => {
    const [a, b] = [...touches.current.values()];
    const left = plotRef.current!.getBoundingClientRect().left;
    pinch.current = {
      view0: viewRef.current,
      dist0: Math.max(20, Math.abs(a - b)),
      anchor: yearAt((a + b) / 2 - left),
    };
    drag.current = null;
  };
  const endTouch = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    touches.current.delete(e.pointerId);
    if (pinch.current) {
      pinch.current = null;
      drag.current = null;
      // 한 손가락이 남으면 그 손가락으로 이어서 끌 수 있게 한다(탭으로 처리되지 않게 moved 표시).
      const rest = [...touches.current.entries()][0];
      if (rest) drag.current = { x0: rest[1], view0: viewRef.current, moved: true, pointerId: rest[0] };
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, e.clientX);
      try {
        plotRef.current!.setPointerCapture(e.pointerId);
      } catch {
        /* 이미 끝난 포인터면 무시 */
      }
      if (touches.current.size === 2) {
        startPinch();
        return;
      }
      if (touches.current.size > 2) return;
    }
    const entryEl = (e.target as HTMLElement).closest<HTMLElement>('[data-entry]');
    drag.current = { x0: e.clientX, view0: view, moved: false, entryId: entryEl?.dataset.entry, pointerId: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const rect = plotRef.current!.getBoundingClientRect();
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, e.clientX);
      const p = pinch.current;
      if (p && touches.current.size >= 2) {
        const [a, b] = [...touches.current.values()];
        const k = p.dist0 / Math.max(20, Math.abs(a - b));
        const span1 = (p.view0.end - p.view0.start) * k;
        // 고정한 연도가 현재 중점 아래에 오도록 위치를 맞춘다(두 손가락으로 이동도 된다).
        const frac = ((a + b) / 2 - rect.left) / width;
        const start = p.anchor - frac * span1;
        onViewChange({ start, end: start + span1 });
        return;
      }
    }
    const d = drag.current;
    if (d && d.pointerId === e.pointerId) {
      const dx = e.clientX - d.x0;
      if (!d.moved && Math.abs(dx) > 4) {
        d.moved = true;
        plotRef.current!.setPointerCapture(e.pointerId);
      }
      if (d.moved) {
        const dy = (dx / width) * (d.view0.end - d.view0.start);
        onViewChange({ start: d.view0.start - dy, end: d.view0.end - dy });
        setHoverX(null);
        return;
      }
    }
    if (e.pointerType === 'mouse') setHoverX(e.clientX - rect.left);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (pinch.current) return endTouch(e);
    endTouch(e);
    const d = drag.current;
    if (d && d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (!d || d.moved) return;
    if (d.entryId) onSelect(d.entryId);
    else onYearChange(yearAt(e.clientX - plotRef.current!.getBoundingClientRect().left));
  };

  const tickList = useMemo(() => ticks(view, width), [view, width]);
  const win = windowFor(view);

  // 트랙마다 라벨이 겹치지 않도록 중요도 순으로 자리를 잡는다.
  const markers = useMemo(() => {
    const out: { entry: Entry; left: number; top: number; label: LabelSide | null }[] = [];
    for (const row of ROWS) {
      const own = entries
        .filter((en) => en.track === row.track.id)
        .map((en) => ({ en, left: ((en.year - view.start) / span) * width }))
        .filter((m) => m.left > -40 && m.left < width + 40);
      const order = [...own].sort(
        (a, b) => b.en.importance - a.en.importance || Math.abs(a.en.year - year) - Math.abs(b.en.year - year),
      );
      const taken: [number, number][] = [];
      const sides = new Map<string, LabelSide>();
      // 다른 라벨과 겹치지 않고, 다른 표식을 덮지 않는 자리인지
      const fits = (a: number, b: number, self: (typeof own)[number]) =>
        a >= -2 &&
        b <= width + 4 &&
        !taken.some(([s, t]) => a < t + 6 && b > s - 6) &&
        // 더 중요한 표식은 가리지 않는다. 덜 중요한 표식은 라벨 아래로 지나가도 된다.
        !own.some((o) => o !== self && o.en.importance >= self.en.importance && o.left > a - 8 && o.left < b + 8);
      for (const m of order) {
        if (m.en.importance === 1 && span > 1500) continue;
        if (m.left < 0 || m.left > width) continue;
        const w = labelWidth(m.en.title);
        if (fits(m.left + 9, m.left + 9 + w, m)) {
          taken.push([m.left, m.left + 9 + w]);
          sides.set(m.en.id, 'right');
        } else if (fits(m.left - 9 - w, m.left - 9, m)) {
          taken.push([m.left - 9 - w, m.left]);
          sides.set(m.en.id, 'left');
        }
      }
      for (const m of own) {
        out.push({ entry: m.en, left: m.left, top: row.eventsTop + EVENT_H / 2, label: sides.get(m.en.id) ?? null });
      }
    }
    return out;
  }, [entries, view, span, width, year]);

  const cursorX = x(year);

  return (
    <section className="timeline" aria-label="연표">
      <div className="tl-labels" style={{ height: TIMELINE_HEIGHT }}>
        <div className="tl-label tl-label--era" style={{ top: RULER_H, height: ERA_H }}>
          시대
        </div>
        {ROWS.map((r) => (
          <div key={r.track.id} className="tl-label" style={{ top: r.top, height: r.height }} title={r.track.region}>
            <span className="tl-swatch" style={{ background: r.track.color }} />
            <span className="tl-label-name">{r.track.name}</span>
          </div>
        ))}
      </div>

      <div
        ref={plotRef}
        className="tl-plot"
        style={{ height: TIMELINE_HEIGHT }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={(e) => {
          endTouch(e);
          drag.current = null;
        }}
        onPointerLeave={() => setHoverX(null)}
      >
        {/* 탐색 창과 눈금선 */}
        <div
          className="tl-window"
          style={{ left: x(year - win), width: Math.max(2, x(year + win) - x(year - win)) }}
        />
        {tickList.map((t) => (
          <div key={t} className={`tl-gridline${t === 0 ? ' tl-gridline--zero' : ''}`} style={{ left: x(t) }} />
        ))}

        {/* 눈금자 */}
        <div className="tl-ruler" style={{ height: RULER_H }}>
          {tickList.map((t) => (
            <span key={t} className="tl-tick" style={{ left: x(t) }}>
              {formatTick(t)}
            </span>
          ))}
        </div>

        {/* 시대 띠 */}
        <div className="tl-eras" style={{ top: RULER_H, height: ERA_H }}>
          {ERAS.map((era, i) => {
            const l = x(era.start);
            const r = x(era.end);
            if (r < 0 || l > width) return null;
            return (
              <div
                key={era.id}
                className={`tl-era${i % 2 ? ' tl-era--alt' : ''}${year >= era.start && year < era.end ? ' is-active' : ''}`}
                style={{ left: l, width: r - l }}
                title={`${era.name} · ${formatRange(era.start, era.end)}`}
              >
                <span style={{ paddingLeft: Math.max(0, -l) + 6 }}>{era.name}</span>
              </div>
            );
          })}
        </div>

        {/* 문명별 시대 막대 */}
        {ROWS.map((row, ri) => (
          <div
            key={row.track.id}
            className={`tl-row${ri % 2 ? ' tl-row--alt' : ''}`}
            style={{ top: row.top, height: row.height, ['--c' as string]: row.track.color }}
          >
            {row.track.periods.map((p) => {
              const l = x(p.start);
              const r = x(p.end);
              if (r < 0 || l > width) return null;
              const lane = row.lanes.get(p.id) ?? 0;
              const active = year >= p.start && year < p.end;
              return (
                <div
                  key={p.id}
                  className={`tl-period${active ? ' is-active' : ''}`}
                  style={{
                    left: l,
                    width: Math.max(2, r - l),
                    top: ROW_PAD + EVENT_H + lane * (LANE_H + LANE_GAP),
                    height: LANE_H,
                  }}
                  title={`${p.name} · ${formatRange(p.start, p.end)}${p.note ? `\n${p.note}` : ''}`}
                >
                  {r - l > 28 && <span style={{ paddingLeft: Math.max(0, -l) + 6 }}>{p.name}</span>}
                </div>
              );
            })}
          </div>
        ))}

        {/* 사건 표식 */}
        {markers.map(({ entry, left, top, label }) => {
          const track = ROWS.find((r) => r.track.id === entry.track)!.track;
          return (
            <button
              key={entry.id}
              data-entry={entry.id}
              className={`tl-marker imp-${entry.importance}${entry.id === selectedId ? ' is-selected' : ''}`}
              style={{ left, top, ['--c' as string]: track.color }}
              aria-label={`${formatYear(entry.year)} ${entry.title}`}
              title={`${formatYear(entry.year)} · ${entry.title}\n${KIND_LABEL[entry.kind]} · ${CERTAINTY_LABEL[entry.certainty]}`}
            >
              <span className={`mark mark--${entry.kind} cert--${entry.certainty}`} aria-hidden />
              {label && <span className={`tl-marker-label tl-marker-label--${label}`}>{entry.title}</span>}
            </button>
          );
        })}

        {/* 마우스 위치 안내선 */}
        {hoverX !== null && (
          <>
            <div className="tl-hover" style={{ left: hoverX }} />
            <span className="tl-hover-label" style={{ left: hoverX }}>
              {formatYear(Math.round(yearAt(hoverX)) || 1)}
            </span>
          </>
        )}

        {/* 선택한 해 */}
        {cursorX >= -2 && cursorX <= width + 2 && (
          <>
            <div className="tl-cursor" style={{ left: cursorX }} />
            <span className="tl-cursor-label" style={{ left: Math.min(Math.max(cursorX, 50), width - 50) }}>
              {formatYear(year)}
            </span>
          </>
        )}
      </div>
    </section>
  );
}
