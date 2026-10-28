import { useId } from 'react';
import { monthShort } from './format';

const W = 340;

function scale(values: number[], h: number, top: number, bottom: number) {
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (max === min) max = min + 1;
  const pad = (max - min) * 0.08;
  min -= min < 0 ? pad : 0;
  max += pad;
  const y = (v: number) => top + (max - v) * ((h - top - bottom) / (max - min));
  return { y, min, max };
}

/**
 * Balance at the end of each month: the line is the horizon, zero is sea level.
 * The month shown on the screen has a vertical line and a dot; tapping a month chooses it.
 */
export function HorizonChart({ months, values, probable, target, selected, onSelect, describe }: {
  months: string[];
  values: number[];
  probable?: number[];
  target?: number[];
  selected?: number;
  onSelect?: (i: number) => void;
  describe?: (i: number) => string;
}) {
  const uid = useId().replace(/:/g, '');
  const H = 150;
  const left = 6;
  const right = 6;
  const all = [...values, ...(probable ?? []), ...(target ?? [])];
  const { y } = scale(all, H, 12, 22);
  const x = (i: number) => left + (i * (W - left - right)) / Math.max(1, months.length - 1);
  const pts = (vs: number[]) => vs.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const y0 = y(0);
  const area = `${x(0)},${y0} ${pts(values)} ${x(values.length - 1)},${y0}`;
  const firstNeg = values.findIndex((v) => v < 0);
  const slot = (W - left - right) / Math.max(1, months.length - 1);
  // about six month names under the chart, whatever the number of months
  const step = Math.max(1, Math.ceil(months.length / 6));
  const sel = selected !== undefined && selected >= 0 && selected < values.length ? selected : -1;
  return (
    <svg className="horizon-chart" viewBox={`0 0 ${W} ${H}`} role={onSelect ? 'group' : 'img'}
      aria-label={`Saldo a fine mese da ${monthShort(months[0])} a ${monthShort(months[months.length - 1])}`}>
      <defs>
        <clipPath id={`up${uid}`}><rect x="0" y="0" width={W} height={y0} /></clipPath>
        <clipPath id={`down${uid}`}><rect x="0" y={y0} width={W} height={H} /></clipPath>
      </defs>
      <polygon points={area} fill="var(--accent-soft)" clipPath={`url(#up${uid})`} />
      <polygon points={area} fill="var(--neg)" opacity="0.16" clipPath={`url(#down${uid})`} />
      <line x1={0} x2={W} y1={y0} y2={y0} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="2 3" />
      {sel >= 0 && <line x1={x(sel)} x2={x(sel)} y1={4} y2={H - 20} stroke="var(--ink)" strokeWidth="1" opacity="0.3" />}
      {target && <polyline points={pts(target)} fill="none" stroke="var(--pos)" strokeWidth="1.5" strokeDasharray="5 4" />}
      {probable && <polyline points={pts(probable)} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="1 4" strokeLinecap="round" />}
      <polyline points={pts(values)} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
      {firstNeg >= 0 && <circle cx={x(firstNeg)} cy={y(values[firstNeg])} r="4.5" fill="var(--neg)" stroke="var(--surface)" strokeWidth="2" />}
      {sel >= 0 && <circle cx={x(sel)} cy={y(values[sel])} r="6" fill={values[sel] < 0 ? 'var(--neg)' : 'var(--accent)'} stroke="var(--surface)" strokeWidth="2.5" />}
      {months.map((m, i) =>
        i % step === 0 ? (
          <text key={m} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === months.length - 1 ? 'end' : 'middle'}>
            {monthShort(m)}
          </text>
        ) : null,
      )}
      {onSelect && months.map((m, i) => (
        <rect key={`hit${m}`} className="hit" x={x(i) - slot / 2} y={0} width={slot} height={H} fill="transparent"
          role="button" tabIndex={0} aria-pressed={i === sel} aria-label={describe ? describe(i) : monthShort(m)}
          onClick={() => onSelect(i)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(i); }
            if (e.key === 'ArrowRight') onSelect(Math.min(months.length - 1, i + 1));
            if (e.key === 'ArrowLeft') onSelect(Math.max(0, i - 1));
          }} />
      ))}
    </svg>
  );
}

/**
 * Monthly margin as bars, coloured by the goal reached, with the minimum as a dashed line
 * and, if given, the average from the start of the year as a line. Tapping a month selects it.
 */
export function MarginBars({ months, values, probable, baseline, colorOf, average, selected, onSelect, describe }: {
  months: string[];
  values: number[];
  probable: number[];
  baseline: number;
  colorOf: (v: number) => string;
  average?: (number | null)[];
  selected?: number;
  onSelect?: (i: number) => void;
  describe?: (i: number) => string;
}) {
  const H = 170;
  const tops = values.map((v, i) => v + Math.max(0, probable[i]));
  const avg = average ?? [];
  const { y } = scale([...values, ...tops, baseline, ...avg.filter((a): a is number => a !== null)], H, 12, 22);
  const slot = (W - 12) / months.length;
  const bw = Math.min(18, slot * 0.62);
  const xc = (i: number) => 6 + slot * i + slot / 2;
  const y0 = y(0);
  const avgPts = avg.map((a, i) => (a === null ? null : [xc(i), y(a)] as const)).filter((p): p is readonly [number, number] => p !== null);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role={onSelect ? 'group' : 'img'} aria-label="Margine di ogni mese rispetto al minimo">
      {selected !== undefined && selected >= 0 && (
        <rect x={6 + slot * selected + 1} y={2} width={slot - 2} height={H - 22} rx="6" fill="var(--accent-soft)" opacity="0.7" />
      )}
      <line x1={0} x2={W} y1={y0} y2={y0} stroke="var(--line)" />
      {values.map((v, i) => {
        const p = Math.max(0, probable[i]);
        const top = y(Math.max(v, 0));
        const bottom = y(Math.min(v, 0));
        return (
          <g key={months[i]}>
            {p > 0 && <rect x={xc(i) - bw / 2} y={y(Math.max(v, 0) + p)} width={bw} height={Math.max(1, top - y(Math.max(v, 0) + p))} rx="3" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1" strokeDasharray="2 2" />}
            <rect x={xc(i) - bw / 2} y={top} width={bw} height={Math.max(1.5, bottom - top)} rx="3" fill={colorOf(v)} />
          </g>
        );
      })}
      <line x1={0} x2={W} y1={y(baseline)} y2={y(baseline)} stroke="var(--ink)" strokeWidth="1.2" strokeDasharray="5 4" />
      {avgPts.length > 0 && (
        <g>
          <polyline points={avgPts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ')} fill="none"
            stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
          {avgPts.map(([px, py], k) => (
            <circle key={k} cx={px} cy={py} r={k === selected ? 4.5 : 3} fill="var(--ink)" stroke="var(--surface)" strokeWidth="1" />
          ))}
        </g>
      )}
      {months.map((m, i) =>
        i % 2 === 0 ? (
          <text key={m} x={xc(i)} y={H - 6} textAnchor="middle">
            {monthShort(m)}
          </text>
        ) : null,
      )}
      {onSelect && months.map((m, i) => (
        <rect key={`hit${m}`} className="hit" x={6 + slot * i} y={0} width={slot} height={H} fill="transparent"
          role="button" tabIndex={0} aria-pressed={i === selected} aria-label={describe ? describe(i) : monthShort(m)}
          onClick={() => onSelect(i)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(i); }
            if (e.key === 'ArrowRight') onSelect(Math.min(months.length - 1, i + 1));
            if (e.key === 'ArrowLeft') onSelect(Math.max(0, i - 1));
          }} />
      ))}
    </svg>
  );
}
