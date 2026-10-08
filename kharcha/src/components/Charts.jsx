import { useLayoutEffect, useRef, useState } from 'react';
import { fmtLong, longMonth, monShort } from '../lib/dates.js';
import { inr, short } from '../lib/format.js';

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceScale(maxP) {
  const max = Math.max(maxP / 100, 1);
  const raw = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step - 1e-9) * step;
  return { step: step * 100, top: top * 100, n: Math.round(top / step) };
}

function barPath(x, y, w, h, r) {
  r = Math.min(r, h, w / 2);
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`;
}

function Tip({ left, top, children }) {
  return (
    <div className="tip" style={{ left, top }}>
      {children}
    </div>
  );
}

/** Spending per day for one month, with a dashed daily-average line. */
export function DailyChart({ byDay, month, avg }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const n = byDay.length;
  const W = Math.max(w, 260);
  const H = 220;
  const L = 46;
  const R = 8;
  const T = 10;
  const B = 26;
  const pw = W - L - R;
  const ph = H - T - B;
  const sc = niceScale(Math.max(...byDay, avg, 1));
  const y = (v) => T + ph - (v / sc.top) * ph;
  const band = pw / n;
  const bw = Math.max(2, Math.min(18, band * 0.68));
  const total = byDay.reduce((a, b) => a + b, 0);
  const label = `Daily spending for ${longMonth(month)}. Total ${inr(total)}, average ${inr(avg)} per day.`;

  function onMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left - L) / band);
    setHover(i >= 0 && i < n ? i : null);
  }
  const date = hover !== null ? `${month}-${String(hover + 1).padStart(2, '0')}` : null;
  return (
    <div className="chart" ref={ref}>
      {w > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={label}>
          {Array.from({ length: sc.n + 1 }, (_, k) => {
            const v = k * sc.step;
            return (
              <g key={k}>
                <line className={k ? 'gl' : 'ax'} x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
                <text className="tk" x={L - 8} y={y(v) + 4} textAnchor="end">{short(v)}</text>
              </g>
            );
          })}
          {hover !== null && <rect className="hl" x={L + hover * band} y={T} width={band} height={ph} />}
          {byDay.map((v, i) => (v ? <path key={i} className="bar" d={barPath(L + i * band + (band - bw) / 2, y(v), bw, T + ph - y(v), 3)} /> : null))}
          {avg > 0 && <line className="avgl" x1={L} x2={W - R} y1={y(avg)} y2={y(avg)} />}
          {Array.from({ length: n }, (_, i) => i + 1)
            .filter((d) => d === 1 || d % 5 === 0)
            .map((d) => (
              <text key={d} className="tk" x={L + (d - 1) * band + band / 2} y={H - 8} textAnchor="middle">{d}</text>
            ))}
          <rect x={L} y={T} width={pw} height={ph} fill="transparent" style={{ touchAction: 'pan-y' }} onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
      )}
      {hover !== null && w > 0 && (
        <Tip left={Math.min(Math.max(L + hover * band + band / 2, 70), W - 70)} top={Math.max(y(byDay[hover]) - 8, 56)}>
          <b>{fmtLong(date)}</b>
          <div className="tr"><span>Spent</span><span>{inr(byDay[hover])}</span></div>
        </Tip>
      )}
    </div>
  );
}

/** Income and spending side by side for several months. */
export function FlowChart({ data }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const n = data.length;
  const W = Math.max(w, 240);
  const H = 220;
  const L = 46;
  const R = 6;
  const T = 10;
  const B = 28;
  const pw = W - L - R;
  const ph = H - T - B;
  const max = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1);
  const sc = niceScale(max);
  const y = (v) => T + ph - (v / sc.top) * ph;
  const band = pw / n;
  const bw = Math.min(26, band * 0.34);
  const label = 'Income and spending by month: ' + data.map((d) => `${longMonth(d.month)} income ${inr(d.income)}, spent ${inr(d.expense)}`).join('; ') + '.';

  function onMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left - L) / band);
    setHover(i >= 0 && i < n ? i : null);
  }
  return (
    <div className="chart" ref={ref}>
      {w > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={label}>
          {Array.from({ length: sc.n + 1 }, (_, k) => {
            const v = k * sc.step;
            return (
              <g key={k}>
                <line className={k ? 'gl' : 'ax'} x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
                <text className="tk" x={L - 8} y={y(v) + 4} textAnchor="end">{short(v)}</text>
              </g>
            );
          })}
          {hover !== null && <rect className="hl" x={L + hover * band} y={T} width={band} height={ph} />}
          {data.map((d, i) => {
            const cx = L + i * band + band / 2;
            return (
              <g key={d.month}>
                {d.income > 0 && <path className="bar income" d={barPath(cx - bw - 1, y(d.income), bw, T + ph - y(d.income), 3)} />}
                {d.expense > 0 && <path className="bar" d={barPath(cx + 1, y(d.expense), bw, T + ph - y(d.expense), 3)} />}
                <text className="tk" x={cx} y={H - 9} textAnchor="middle">{monShort(d.month)}</text>
              </g>
            );
          })}
          <rect x={L} y={T} width={pw} height={ph} fill="transparent" style={{ touchAction: 'pan-y' }} onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
      )}
      {hover !== null && w > 0 && (
        <Tip left={Math.min(Math.max(L + hover * band + band / 2, 80), W - 80)} top={Math.max(y(Math.max(data[hover].income, data[hover].expense)) - 8, 70)}>
          <b>{longMonth(data[hover].month)}</b>
          <div className="tr"><span>Income</span><span>{inr(data[hover].income)}</span></div>
          <div className="tr"><span>Spent</span><span>{inr(data[hover].expense)}</span></div>
          <div className="tr"><span>Kept</span><span>{data[hover].income - data[hover].expense < 0 ? '−' : ''}{inr(Math.abs(data[hover].income - data[hover].expense))}</span></div>
        </Tip>
      )}
    </div>
  );
}
