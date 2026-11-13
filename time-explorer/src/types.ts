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
  /** 속한 묶음(GROUPS)의 id. 같은 묶음의 줄은 TRACKS 안에서 연달아 있어야 한다. */
  group?: string;
}

/** 한 줄 안의 지도자 재위 막대 lane (예: 영국의 군주, 총리) */
export interface RulerLane {
  id: string;
  name: string;
  /** 시간순, 서로 겹치지 않는 재위 기간 */
  rulers: Period[];
}

/** 여러 줄을 접고 펼 수 있게 묶은 것. periods는 접었을 때 보여 줄 요약 시대다. */
export interface Group {
  id: string;
  name: string;
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
