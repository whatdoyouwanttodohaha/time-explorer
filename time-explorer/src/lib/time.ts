import type { Certainty, EntryKind, Period } from '../types';
import { MAX_YEAR, MIN_YEAR } from '../data/tracks';

export interface View {
  start: number;
  end: number;
}

export const FULL_VIEW: View = { start: MIN_YEAR - 60, end: MAX_YEAR + 40 };
export const MIN_SPAN = 12;

/** 0년이 없으므로 반올림 결과가 0이면 1년으로 옮긴다. */
export function toYear(x: number): number {
  const y = Math.round(x);
  if (y === 0) return x < 0 ? -1 : 1;
  return Math.min(MAX_YEAR, Math.max(MIN_YEAR, y));
}

export function formatYear(y: number): string {
  return y < 0 ? `기원전 ${-y}년` : `${y}년`;
}

export function formatTick(y: number): string {
  if (y === 0) return '기원';
  return y < 0 ? `기원전 ${-y}` : String(y);
}

export function formatRange(start: number, end: number): string {
  if (start < 0 && end < 0) return `기원전 ${-start}–${-end}년`;
  return `${formatYear(start)} – ${end >= MAX_YEAR ? '현재' : formatYear(end)}`;
}

export function clampView(v: View): View {
  let span = Math.max(MIN_SPAN, Math.min(v.end - v.start, FULL_VIEW.end - FULL_VIEW.start));
  let start = v.start;
  if (start < FULL_VIEW.start) start = FULL_VIEW.start;
  if (start + span > FULL_VIEW.end) start = FULL_VIEW.end - span;
  span = Math.max(span, MIN_SPAN);
  return { start, end: start + span };
}

export function viewAround(center: number, span: number): View {
  return clampView({ start: center - span / 2, end: center + span / 2 });
}

const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

export function ticks(view: View, widthPx: number, minGapPx = 90): number[] {
  const span = view.end - view.start;
  const step = STEPS.find((s) => (s / span) * widthPx >= minGapPx) ?? 1000;
  const out: number[] = [];
  for (let t = Math.ceil(view.start / step) * step; t <= view.end; t += step) out.push(t);
  return out;
}

/** 탐색 창(±년): 보이는 범위가 넓을수록 넓게 */
export function windowFor(view: View): number {
  const span = view.end - view.start;
  return Math.max(3, Math.min(60, Math.round(span * 0.012)));
}

/** 겹치는 시대를 여러 줄로 나눠 배치한다. */
export function assignLanes(periods: Period[]): { lanes: Map<string, number>; count: number } {
  const lanes = new Map<string, number>();
  const laneEnds: number[] = [];
  for (const p of [...periods].sort((a, b) => a.start - b.start)) {
    let lane = laneEnds.findIndex((end) => end <= p.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(p.end);
    } else {
      laneEnds[lane] = p.end;
    }
    lanes.set(p.id, lane);
  }
  return { lanes, count: Math.max(1, laneEnds.length) };
}

export const KIND_LABEL: Record<EntryKind, string> = {
  event: '사건',
  person: '인물',
  phenomenon: '자연현상',
};

export const CERTAINTY_LABEL: Record<Certainty, string> = {
  confirmed: '확실',
  probable: '유력',
  estimated: '추정',
  disputed: '논쟁 중',
};

export const CERTAINTY_HINT: Record<Certainty, string> = {
  confirmed: '사료로 연도가 확인됨',
  probable: '근거가 충분하지만 몇 년의 오차가 있을 수 있음',
  estimated: '고고학·과학적 추정치',
  disputed: '학설이나 전승에 따라 연대가 크게 다름',
};
