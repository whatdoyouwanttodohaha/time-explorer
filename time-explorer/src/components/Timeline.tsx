import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Entry, Period, RulerLane } from '../types';
import { ERAS, GROUP_BY_ID, TRACKS, TRACK_BY_ID } from '../data/tracks';
import { RULERS } from '../data/rulers';
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

const GROUP_HEAD_H = 30;
/** 지도자 재위 막대 높이 */
const REIGN_H = 18;

interface RowLayout {
  id: string;
  /** track: 묶이지 않은 줄, child: 펼친 묶음의 하위 줄, closed: 접은 묶음, head: 펼친 묶음의 머리 줄 */
  type: 'track' | 'child' | 'closed' | 'head';
  name: string;
  region: string;
  color: string;
  periods: Period[];
  /** 지도자 재위 lane (펼친 나라 줄에만) */
  rulerLanes: RulerLane[];
  /** 첫 재위 lane의 top (줄 top 기준) */
  reignTop: number;
  /** 이 줄에 표식을 그릴 트랙들 */
  trackIds: string[];
  groupId?: string;
  top: number;
  height: number;
  lanes: Map<string, number>;
  eventsTop: number;
}

/** 펼친 묶음에 따라 줄 배치를 계산한다. */
function buildRows(open: Set<string>): RowLayout[] {
  const rows: RowLayout[] = [];
  let top = RULER_H + ERA_H;
  const push = (r: Omit<RowLayout, 'top' | 'height' | 'lanes' | 'eventsTop' | 'reignTop'>) => {
    const { lanes, count } = assignLanes(r.periods);
    const laneCount = r.periods.length ? count : 0;
    const reignTop = ROW_PAD + EVENT_H + laneCount * (LANE_H + LANE_GAP) + (r.rulerLanes.length ? 2 : 0);
    const height =
      r.type === 'head' ? GROUP_HEAD_H : reignTop + r.rulerLanes.length * (REIGN_H + LANE_GAP) + ROW_PAD;
    rows.push({ ...r, top, height, lanes, eventsTop: top + ROW_PAD, reignTop });
    top += height;
  };
  const seen = new Set<string>();
  for (const track of TRACKS) {
    const g = track.group ? GROUP_BY_ID[track.group] : undefined;
    if (g && !seen.has(g.id)) {
      seen.add(g.id);
      const isOpen = open.has(g.id);
      push({
        id: `group:${g.id}`,
        type: isOpen ? 'head' : 'closed',
        name: g.name,
        region: g.region,
        color: g.color,
        periods: isOpen ? [] : g.periods,
        rulerLanes: [],
        trackIds: isOpen ? [] : TRACKS.filter((t) => t.group === g.id).map((t) => t.id),
        groupId: g.id,
      });
    }
    if (g && !open.has(g.id)) continue;
    push({
      id: track.id,
      type: g ? 'child' : 'track',
      name: track.name,
      region: track.region,
      color: track.color,
      periods: track.periods,
      rulerLanes: RULERS[track.id] ?? [],
      trackIds: [track.id],
      groupId: g?.id,
    });
  }
  return rows;
}

interface Props {
  view: View;
  year: number;
  entries: Entry[];
  selectedId: string | null;
  /** 펼쳐 둔 묶음 id */
  openGroups: Set<string>;
  onToggleGroup: (id: string) => void;
  onViewChange: (v: View) => void;
  onYearChange: (y: number) => void;
  onSelect: (id: string) => void;
}

type LabelSide = 'right' | 'left';

/** 한글 라벨의 대략적인 픽셀 너비 (12px 기준) */
const labelWidth = (text: string) => text.length * 11.5 + 6;

export function Timeline({
  view,
  year,
  entries,
  selectedId,
  openGroups,
  onToggleGroup,
  onViewChange,
  onYearChange,
  onSelect,
}: Props) {
  const rows = useMemo(() => buildRows(openGroups), [openGroups]);
  const height = rows[rows.length - 1].top + rows[rows.length - 1].height;
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
    for (const row of rows) {
      if (!row.trackIds.length) continue;
      // 접은 묶음은 여러 줄을 한 줄에 합치므로 주요 사건만(넓게 볼 때는 핵심만) 보여 준다.
      const minImp = row.type === 'closed' ? (span > 1500 ? 3 : 2) : 1;
      const own = entries
        .filter((en) => row.trackIds.includes(en.track) && en.importance >= minImp)
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
  }, [entries, rows, view, span, width, year]);

  const cursorX = x(year);

  return (
    <section className="timeline" aria-label="연표">
      <div className="tl-labels" style={{ height }}>
        <div className="tl-label tl-label--era" style={{ top: RULER_H, height: ERA_H }}>
          시대
        </div>
        {rows.map((r) =>
          r.type === 'closed' || r.type === 'head' ? (
            <button
              key={r.id}
              className={`tl-label tl-label--group${r.type === 'head' ? ' is-open' : ''}`}
              style={{ top: r.top, height: r.height }}
              title={`${r.region} · 눌러서 ${r.type === 'head' ? '접기' : '펼치기'}`}
              aria-expanded={r.type === 'head'}
              onClick={() => onToggleGroup(r.groupId!)}
            >
              <span className="tl-chevron" aria-hidden />
              <span className="tl-label-name">{r.name}</span>
            </button>
          ) : (
            <div
              key={r.id}
              className={`tl-label${r.type === 'child' ? ' tl-label--child' : ''}`}
              style={{ top: r.top, height: r.height }}
              title={r.region}
            >
              <span className="tl-swatch" style={{ background: r.color }} />
              <span className="tl-label-name">{r.name}</span>
              {r.rulerLanes.map((l, i) => (
                <span
                  key={l.id}
                  className="tl-lane-label"
                  style={{ top: r.reignTop + i * (REIGN_H + LANE_GAP), height: REIGN_H }}
                >
                  {l.name}
                </span>
              ))}
            </div>
          ),
        )}
      </div>

      <div
        ref={plotRef}
        className="tl-plot"
        style={{ height }}
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
        {rows.map((row, ri) => (
          <div
            key={row.id}
            className={`tl-row${ri % 2 ? ' tl-row--alt' : ''}${row.type === 'head' ? ' tl-row--head' : ''}`}
            style={{ top: row.top, height: row.height, ['--c' as string]: row.color }}
          >
            {row.periods.map((p) => {
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
            {row.rulerLanes.map((lane, li) =>
              lane.rulers.map((p, pi) => {
                const l = x(p.start);
                const r = x(p.end);
                if (r < 0 || l > width) return null;
                const active = year >= p.start && year < p.end;
                return (
                  <div
                    key={p.id}
                    className={`tl-reign${pi % 2 ? ' tl-reign--alt' : ''}${active ? ' is-active' : ''}`}
                    style={{
                      left: l,
                      width: Math.max(2, r - l),
                      top: row.reignTop + li * (REIGN_H + LANE_GAP),
                      height: REIGN_H,
                    }}
                    title={`${lane.name} · ${p.name} · ${formatRange(p.start, p.end)}${p.note ? `\n${p.note}` : ''}`}
                  >
                    {r - l > 24 && <span style={{ paddingLeft: Math.max(0, -l) + 4 }}>{p.name}</span>}
                  </div>
                );
              }),
            )}
          </div>
        ))}

        {/* 사건 표식 */}
        {markers.map(({ entry, left, top, label }) => {
          const track = TRACK_BY_ID[entry.track];
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
