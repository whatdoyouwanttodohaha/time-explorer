import type { Certainty } from '../types';
import { CERTAINTY_HINT, CERTAINTY_LABEL } from '../lib/time';

const CERTS: Certainty[] = ['confirmed', 'probable', 'estimated', 'disputed'];

export function Legend() {
  return (
    <div className="legend">
      <div className="legend-group" aria-label="연대 확실성">
        {CERTS.map((c) => (
          <span key={c} className="legend-item" title={CERTAINTY_HINT[c]}>
            <span className={`mark mark--event cert--${c}`} aria-hidden />
            {CERTAINTY_LABEL[c]}
          </span>
        ))}
      </div>
      <p className="legend-hint">
        클릭해서 해 고르기 · 끌어서 이동 · <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + 스크롤로 확대 · <kbd>←</kbd> <kbd>→</kbd> 해 이동 ·{' '}
        <kbd>[</kbd> <kbd>]</kbd> 사건 이동
      </p>
    </div>
  );
}
