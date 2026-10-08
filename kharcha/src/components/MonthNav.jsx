import { Icon } from './ui.jsx';
import { addMonth, longMonth, monthOf, todayStr } from '../lib/dates.js';
import { useData } from '../data/store.jsx';

export default function MonthNav() {
  const { month, setMonth } = useData();
  const cur = monthOf(todayStr());
  return (
    <div className="monthnav" role="group" aria-label="Choose month">
      <button type="button" className="icon-btn" onClick={() => setMonth(addMonth(month, -1))} aria-label="Previous month">
        <Icon name="left" size={16} />
      </button>
      <span className="mlabel" aria-live="polite">{longMonth(month)}</span>
      <button type="button" className="icon-btn" onClick={() => setMonth(addMonth(month, 1))} disabled={month >= cur} aria-label="Next month">
        <Icon name="right" size={16} />
      </button>
      {month !== cur && (
        <button type="button" className="link small" onClick={() => setMonth(cur)}>
          Today
        </button>
      )}
    </div>
  );
}
