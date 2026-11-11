import type { Certainty, EntryKind } from '../types';

export type Row = [
  id: string,
  kind: EntryKind,
  track: string,
  year: number,
  title: string,
  certainty: Certainty,
  importance: 1 | 2 | 3,
  summary: string,
];

export const E = 'event' as const;
export const P = 'person' as const;
export const N = 'phenomenon' as const;
