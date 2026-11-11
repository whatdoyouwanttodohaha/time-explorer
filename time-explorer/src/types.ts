/** 연도는 정수. 음수는 기원전(-221 = 기원전 221년). 0년은 없다. */
export type Year = number;

export type Certainty = 'confirmed' | 'probable' | 'estimated' | 'disputed';
export type EntryKind = 'event' | 'person' | 'phenomenon';

export interface Era {
  id: string;
  name: string;
  start: Year;
  end: Year;
}

export interface Period {
  id: string;
  name: string;
  start: Year;
  end: Year;
  note?: string;
}

export interface Track {
  id: string;
  name: string;
  /** 짧은 설명: 이 트랙이 다루는 지역 */
  region: string;
  color: string;
  periods: Period[];
}

export interface Entry {
  id: string;
  kind: EntryKind;
  title: string;
  year: Year;
  track: string;
  certainty: Certainty;
  /** 1 = 참고, 2 = 주요, 3 = 핵심 */
  importance: 1 | 2 | 3;
  summary: string;
}
