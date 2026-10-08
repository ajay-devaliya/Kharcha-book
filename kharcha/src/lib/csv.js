/** Parse CSV text into rows of strings. Handles quotes, CRLF, BOM and , ; tab | delimiters. */
export function parseCSV(text) {
  text = String(text).replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  let delim = ',';
  let best = 0;
  for (const d of [',', ';', '\t', '|']) {
    const n = firstLine.split(d).length - 1;
    if (n > best) {
      best = n;
      delim = d;
    }
  }
  const rows = [];
  let row = [];
  let cur = '';
  let quoted = false;
  const endRow = () => {
    row.push(cur);
    cur = '';
    if (row.some((x) => x.trim() !== '')) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else cur += c;
  }
  endRow();
  return rows;
}

/** A safe CSV cell: quoted, with a leading apostrophe on anything a spreadsheet could run as a formula. */
export function csvCell(v) {
  let t = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return '"' + t.replace(/"/g, '""') + '"';
}
