import { useEffect, useState } from 'react';
import { Dot, Icon } from './ui.jsx';
import { fmtShort } from '../lib/dates.js';
import { inr } from '../lib/format.js';
import { METHOD, catName } from '../lib/categories.js';

/** One entry in a list. Delete asks twice so a stray tap does not remove anything. */
export default function TxRow({ t, onEdit, onDelete, showDate = true }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const id = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(id);
  }, [armed]);
  return (
    <li className={'tx' + (showDate ? '' : ' nodate')}>
      {showDate && <span className="tx-date">{fmtShort(t.date)}</span>}
      <div className="tx-main">
        <div className="tx-note">{t.note || catName(t.category)}</div>
        <div className="tx-meta">
          <Dot id={t.category} size={8} />
          {catName(t.category)}
          {METHOD[t.method] ? ' · ' + METHOD[t.method] : ''}
          {t.recurringId && <span className="tag">Recurring</span>}
        </div>
      </div>
      <span className={'tx-amt ' + t.type}>
        {t.type === 'income' ? '+' : ''}
        {inr(t.amount)}
      </span>
      <div className="tx-acts">
        {onEdit && (
          <button type="button" className="icon-btn sm" onClick={() => onEdit(t)} aria-label={`Edit ${t.note || catName(t.category)}`}>
            <Icon name="edit" size={15} />
          </button>
        )}
        {onDelete &&
          (armed ? (
            <button type="button" className="btn-danger sm" onClick={() => { setArmed(false); onDelete(t); }}>
              Confirm delete
            </button>
          ) : (
            <button type="button" className="icon-btn sm" onClick={() => setArmed(true)} aria-label={`Delete ${t.note || catName(t.category)}`}>
              <Icon name="trash" size={15} />
            </button>
          ))}
      </div>
    </li>
  );
}
