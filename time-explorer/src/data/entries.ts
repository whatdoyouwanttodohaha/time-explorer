import type { Entry } from '../types';
import type { Row } from './row';
import { GLOBAL_ROWS } from './entries-global';
import { KOREA_ROWS } from './entries-korea';
import { CHINA_ROWS } from './entries-china';
import { EUROPE_ROWS } from './entries-europe';
import { SEASIA_ROWS } from './entries-seasia';
import { STEPPE_ROWS } from './entries-steppe';
import { JAPAN_ROWS } from './entries-japan';
import { WESTASIA_ROWS } from './entries-westasia';
import { EGYPT_ROWS } from './entries-egypt';
import { SOUTH_ASIA_ROWS } from './entries-southasia';
import { MAGHREB_ROWS } from './entries-maghreb';
import { WEST_AFRICA_ROWS } from './entries-westafrica';
import { EAST_AFRICA_ROWS } from './entries-eastafrica';
import { NORTH_AMERICA_ROWS } from './entries-northamerica';
import { LATAM_ROWS } from './entries-latam';

const ROWS: Row[] = [
  ...GLOBAL_ROWS,
  ...KOREA_ROWS,
  ...CHINA_ROWS,
  ...EUROPE_ROWS,
  ...SEASIA_ROWS,
  ...STEPPE_ROWS,
  ...JAPAN_ROWS,
  ...WESTASIA_ROWS,
  ...EGYPT_ROWS,
  ...SOUTH_ASIA_ROWS,
  ...MAGHREB_ROWS,
  ...WEST_AFRICA_ROWS,
  ...EAST_AFRICA_ROWS,
  ...NORTH_AMERICA_ROWS,
  ...LATAM_ROWS,
];

export const ENTRIES: Entry[] = ROWS.map(([id, kind, track, year, title, certainty, importance, summary]) => ({
  id, kind, track, year, title, certainty, importance, summary,
})).sort((a, b) => a.year - b.year);

export const ENTRY_BY_ID: Record<string, Entry> = Object.fromEntries(ENTRIES.map((e) => [e.id, e]));
