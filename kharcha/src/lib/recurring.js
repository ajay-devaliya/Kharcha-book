import { addMonth, daysIn, monthOf, pad } from './dates.js';

/** The date a rule lands on in a given month. Day 31 becomes the last day of shorter months. */
export function dateInMonth(rule, month) {
  return `${month}-${pad(Math.min(rule.day, daysIn(month)))}`;
}

/**
 * Dates this rule should have produced up to `today` that are not in `existing` yet.
 * `existing` is a Set of 'YYYY-MM-DD' strings already created by this rule.
 * `rule.generatedThrough` is the last day the app already checked, so an entry the person
 * deleted by hand is not created again on the next visit.
 */
export function dueOccurrences(rule, existing, today) {
  if (!rule.active) return [];
  const out = [];
  let m = monthOf(rule.startDate);
  const last = monthOf(today);
  for (let i = 0; i < 600 && m <= last; i++, m = addMonth(m, 1)) {
    const d = dateInMonth(rule, m);
    if (d < rule.startDate || d > today) continue;
    if (rule.endDate && d > rule.endDate) continue;
    if (rule.generatedThrough && d <= rule.generatedThrough) continue;
    if (existing.has(d)) continue;
    out.push(d);
  }
  return out;
}

/** The next date after `today` this rule will land on, or null if it has ended or is paused. */
export function nextOccurrence(rule, today) {
  if (!rule.active) return null;
  let m = monthOf(today);
  for (let i = 0; i < 26; i++, m = addMonth(m, 1)) {
    const d = dateInMonth(rule, m);
    if (d <= today || d < rule.startDate) continue;
    if (rule.endDate && d > rule.endDate) return null;
    return d;
  }
  return null;
}
