import { Children, isValidElement, useId, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Flag, LayoutGrid, Sparkles } from 'lucide-react';
import { Avatar } from './Display';

/*
 * Metric cards from the UI kit (Screens/ui-kit.html, section 2). Pick the design from what
 * the card shows, never by position:
 *   AreaCard      trend of a count (sparkline)        WatermarkCard  plain count
 *   AlertCard     needs attention (red)                ColumnsCard    volume over time (dark, bars)
 *   DonutCard     percentage / rate                    StackCard      people
 *   RowsCard      breakdown by status                  GaugeCard      used vs limit
 *   PieCard       breakdown as a multi-colour donut
 * Every card takes `title`, `icon` and `pill` (the value shown when the summary is collapsed).
 */

const fmt = (n) => (n === null || n === undefined ? '—' : new Intl.NumberFormat('en-IN').format(n));

function Head({ title, icon: Icon }) {
  return (
    <div className="mc-head">
      <span className="mc-title">{title}</span>
      <span className="mc-ico">{Icon && <Icon />}</span>
    </div>
  );
}

export function McSubs({ items }) {
  if (!items?.length) return null;
  return (
    <div className="mc-subs">
      {items.map(([value, label]) => (
        <div key={label} className="mc-sub">
          <b>{fmt(value)}</b>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function Trend({ value, label, down }) {
  if (!value) return null;
  return <span className={`mc-trend ${down ? 'down' : 'up'}`}>{down ? '▼' : '▲'} {fmt(value)} {label}</span>;
}

/** Sparkline points in the 0–100 box used by the kit (line between y≈20 and y≈66). */
function sparkPoints(series) {
  const s = series?.length ? series : [0, 0];
  const min = Math.min(...s);
  const max = Math.max(...s);
  const step = 100 / (s.length - 1 || 1);
  return s.map((v, i) => {
    const y = max === min ? 58 : 66 - ((v - min) / (max - min)) * 46;
    return `${(i * step).toFixed(1)},${y.toFixed(0)}`;
  });
}

export function AreaCard({ title, icon, value, trend, subs, series }) {
  const gid = useId().replace(/:/g, '');
  const pts = sparkPoints(series);
  return (
    <div className="metric-card mc-area">
      <Head title={title} icon={icon} />
      <div>
        <div className="row" style={{ gap: 10 }}>
          <div className="mc-value">{fmt(value)}</div>
          {trend && <Trend {...trend} />}
        </div>
        {subs && (
          <div style={{ marginTop: 12 }}>
            <McSubs items={subs} />
          </div>
        )}
      </div>
      <div className="mc-chart">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#16A34A" stopOpacity=".35" />
              <stop offset="1" stopColor="#16A34A" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`M0,100 L${pts.join(' L')} L100,100 Z`} fill={`url(#${gid})`} />
          <polyline className="line" points={pts.join(' ')} />
        </svg>
      </div>
    </div>
  );
}

export function WatermarkCard({ title, icon: Icon, value, unit, subs }) {
  return (
    <div className="metric-card mc-watermark">
      <span className="wm">{Icon && <Icon />}</span>
      <Head title={title} icon={Icon} />
      <div className="mc-value">
        {fmt(value)}
        {unit && <small>{unit}</small>}
      </div>
      <McSubs items={subs} />
    </div>
  );
}

/**
 * items: [{ key, name (avatar), label, percent }] – percent draws the red over-limit bar,
 * or pass `pill` for a text pill (e.g. "3d late").
 */
export function AlertCard({ title, icon, value, badge = 'Needs review', items = [], action, more, emptyText }) {
  return (
    <div className="metric-card mc-alert">
      <span className="al-rings" />
      <Head title={title} icon={icon} />
      <div className="row" style={{ gap: 10, alignItems: 'center' }}>
        <div className="mc-value">{fmt(value)}</div>
        {value > 0 && (
          <span className="al-badge">
            <Flag />
            {badge}
          </span>
        )}
      </div>
      <div className="al-items">
        {items.map((it) => (
          <div key={it.key} className="al-item">
            <div className="al-top">
              <Avatar name={it.name} />
              <b title={it.label}>{it.label}</b>
              {it.percent !== undefined && (
                <>
                  <span className="al-bar">
                    {/* the bar spans 0–120%; the marker shows 100% */}
                    <span style={{ width: `${Math.min(100, (it.percent / 120) * 100).toFixed(1)}%` }} />
                    <i style={{ left: '83.3%' }} title="100% of allocation" />
                  </span>
                  <span className="al-val">{it.percent}%</span>
                </>
              )}
              {it.pill && <span className="al-pill">{it.pill}</span>}
            </div>
          </div>
        ))}
        {!items.length && emptyText && <span className="small" style={{ color: '#B42318', opacity: 0.75 }}>{emptyText}</span>}
      </div>
      {(action || more) && (
        <div className="mc-foot">
          {action && (
            <button type="button" className="al-btn" onClick={action.onClick} style={{ border: 0, cursor: 'pointer', font: 'inherit' }}>
              {action.label}
              <ArrowRight />
            </button>
          )}
          {more > 0 && <span className="al-more">+{more} more</span>}
        </div>
      )}
    </div>
  );
}

/** bars: [{ value, label }] – the highlighted bar shows its value above it. */
export function ColumnsCard({ title, icon, value, unit, trend, subs, bars = [], days = [], highlight }) {
  const max = Math.max(...bars.map((b) => b.value), 0);
  const hi = highlight ?? bars.reduce((best, b, i) => (b.value > (bars[best]?.value ?? -1) ? i : best), 0);
  return (
    <div className="metric-card mc-columns">
      <span className="ring-deco" />
      <Head title={title} icon={icon} />
      <div className="mc-body">
        <div>
          <div className="mc-value">
            {fmt(value)}
            {unit && <small>{unit}</small>}
          </div>
          {trend && (
            <div style={{ marginTop: 10 }}>
              <Trend {...trend} />
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <McSubs items={subs} />
          </div>
        </div>
        <div>
          <div className="cols">
            {bars.map((b, i) => (
              <i
                key={i}
                className={i === hi && b.value > 0 ? 'hi' : ''}
                style={{ height: `${max ? Math.max(8, (b.value / max) * 80) : 8}%` }}
                data-v={b.label}
              />
            ))}
          </div>
          <div className="days">
            {days.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const DONUT_C = 289.0; // 2πr, r = 46

/** legend: [[label, percent, color]] */
export function DonutCard({ title, icon, percent, value, unit, legend = [] }) {
  const gid = useId().replace(/:/g, '');
  const p = Math.max(0, Math.min(100, percent ?? 0));
  const rest = 100 - p;
  return (
    <div className="metric-card mc-donut">
      <Head title={title} icon={icon} />
      <div className="mc-body">
        <div className="donut">
          <svg viewBox="0 0 112 112" aria-hidden="true">
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#22C55E" />
                <stop offset="1" stopColor="#14532D" />
              </linearGradient>
            </defs>
            <circle className="track" cx="56" cy="56" r="46" />
            <circle className="val" cx="56" cy="56" r="46" strokeDasharray={`${((DONUT_C * p) / 100).toFixed(1)} ${DONUT_C}`} style={{ stroke: `url(#${gid})` }} />
          </svg>
          <div className="center">
            <div>
              <b>{Math.round(p)}%</b>
            </div>
          </div>
          {rest > 0 && rest < 100 && (
            <span className="mc-float" style={{ right: -14, top: -6 }}>
              {Math.round(rest)}%
            </span>
          )}
        </div>
        <div className="legend">
          <div className="mc-value" style={{ fontSize: 24 }}>
            {fmt(value)}
            {unit && <small>{unit}</small>}
          </div>
          {legend.map(([label, pct, color]) => (
            <span key={label} title={`${label}: ${Math.round(pct * 100) / 100}%`}>
              <i style={{ background: color }} />
              <em>{label}</em>
              <b>{fmt(Math.round(pct * 100) / 100)}%</b>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const PIE_COLORS = ['#15803D', '#4ADE80', '#0B3B22', '#BEF264', '#22C55E', '#166534', '#A3E635', '#86EFAC', '#14532D', '#65A30D'];

/**
 * Breakdown as a multi-colour donut: items [{ key, label, value }] – the legend lists the largest
 * `max` items and "+N more"; onSelect(item) makes legend rows clickable (e.g. to filter).
 */
export function PieCard({ title, icon, items = [], caption = 'total', max = 4, onSelect }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const colored = items.map((it, i) => ({ ...it, color: PIE_COLORS[i % PIE_COLORS.length] }));
  const shown = [...colored].sort((a, b) => b.value - a.value).slice(0, max);
  let offset = 0;
  return (
    <div className="metric-card mc-donut mc-pie">
      <Head title={title} icon={icon} />
      <div className="mc-body">
        <div className="donut">
          <svg viewBox="0 0 112 112" aria-hidden="true">
            <circle className="track" cx="56" cy="56" r="46" />
            {total > 0 &&
              colored.map((it) => {
                const len = (DONUT_C * it.value) / total;
                const seg = (
                  <circle
                    key={it.key}
                    className="seg"
                    cx="56"
                    cy="56"
                    r="46"
                    stroke={it.color}
                    strokeDasharray={`${Math.max(0, len - (colored.length > 1 ? 1.5 : 0)).toFixed(1)} ${DONUT_C}`}
                    strokeDashoffset={(-offset).toFixed(1)}
                  />
                );
                offset += len;
                return seg;
              })}
          </svg>
          <div className="center">
            <div>
              <b>{fmt(total)}</b>
              <small>{caption}</small>
            </div>
          </div>
        </div>
        <div className="legend">
          {shown.map((it) => (
            <span
              key={it.key}
              className={onSelect ? 'is-link' : undefined}
              onClick={onSelect ? () => onSelect(it) : undefined}
              title={`${it.label}: ${it.value}`}
            >
              <i style={{ background: it.color }} />
              <em>{it.label}</em>
              <b>{fmt(it.value)}</b>
            </span>
          ))}
          {colored.length > shown.length && <span className="muted">+{colored.length - shown.length} more</span>}
          {!items.length && <span className="muted">No projects yet</span>}
        </div>
      </div>
    </div>
  );
}

/** people: [{ id, name }] – shows up to 4 avatars and "+N". */
export function StackCard({ title, icon, value, people = [], emptyText = 'Nobody' }) {
  const shown = people.slice(0, 4);
  const extra = Math.max(0, (value ?? 0) - shown.length);
  const first = shown.slice(0, 2).map((p) => p.name.split(' ')[0]);
  const names = !shown.length ? emptyText : value > 2 ? `${first.join(', ')} and others` : first.join(' and ');
  return (
    <div className="metric-card mc-stack">
      <span className="blob" />
      <Head title={title} icon={icon} />
      <div className="mc-value">{fmt(value)}</div>
      <div>
        <div className="people">
          {shown.map((p) => (
            <Avatar key={p.id} name={p.name} size="md" />
          ))}
          {extra > 0 && <span className="more">+{extra}</span>}
        </div>
        <div className="names">{names}</div>
      </div>
    </div>
  );
}

const ROW_COLORS = ['#15803D', '#22C55E', '#0B3B22', '#86EFAC'];

/** rows: [[label, value]] – bars are relative to the largest row. */
export function RowsCard({ title, icon, value, caption = 'total', rows = [] }) {
  const max = Math.max(...rows.map(([, v]) => v), 0);
  return (
    <div className="metric-card mc-rows">
      <Head title={title} icon={icon} />
      <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
        <div className="mc-value">{fmt(value)}</div>
        <span className="mc-caption">{caption}</span>
      </div>
      <div className="rows">
        {rows.map(([label, v], i) => (
          <div key={label} className="r">
            <span>{label}</span>
            <div className="t">
              <span style={{ width: `${max ? (v / max) * 100 : 0}%`, background: ROW_COLORS[i % ROW_COLORS.length] }} />
            </div>
            <b>{fmt(v)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

const GAUGE_LEN = 251.3; // half circle, r = 80

export function GaugeCard({ title, icon, value, max, unit = 'h', pill, caption = 'used' }) {
  const gid = useId().replace(/:/g, '');
  const ratio = max ? Math.max(0, Math.min(1, value / max)) : 0;
  const angle = Math.PI * (1 - ratio);
  const cx = 95 + 80 * Math.cos(angle);
  const cy = 95 - 80 * Math.sin(angle);
  return (
    <div className="metric-card mc-gauge">
      <Head title={title} icon={icon} />
      {pill && (
        <span className="mc-pill" style={{ left: '50%', transform: 'translateX(-50%)', top: 62 }}>
          <Sparkles style={{ width: 12, height: 12, verticalAlign: -2 }} /> {pill}
        </span>
      )}
      <div className="gauge">
        <svg viewBox="0 0 190 104" aria-hidden="true">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#86EFAC" />
              <stop offset="1" stopColor="#15803D" />
            </linearGradient>
          </defs>
          <path className="track" d="M15 95 A80 80 0 0 1 175 95" />
          <path className="val" d="M15 95 A80 80 0 0 1 175 95" strokeDasharray={`${(GAUGE_LEN * ratio).toFixed(1)} ${GAUGE_LEN}`} style={{ stroke: `url(#${gid})` }} />
          <circle className="needle" cx={cx.toFixed(1)} cy={cy.toFixed(1)} r="5" />
        </svg>
        <div className="read">
          <b>
            {fmt(value)}
            <small>
              {' '}
              / {max ? `${fmt(max)} ${unit}` : '—'}
            </small>
          </b>
        </div>
      </div>
      <div className="ends">
        <span>0</span>
        <span>{max ? `${Math.round((value / max) * 100)}% ${caption}` : 'No estimate'}</span>
        <span>{max ? fmt(max) : '—'}</span>
      </div>
    </div>
  );
}

const readCollapsed = (key) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

/**
 * "SUMMARY · Hide/Show" row from the design (app.js initCardCollapse): open by default,
 * collapsed = one slim strip of title · value pills. Remembered per page.
 * Each child card needs `title` and `pill` (string/number shown in the strip; falls back to `value`).
 */
export function KpiSection({ storageKey, columns = 4, children, style }) {
  const key = `pms.kpi.${storageKey}`;
  const [collapsed, setCollapsed] = useState(() => readCollapsed(key));
  const cards = Children.toArray(children).filter(isValidElement);

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(key, c ? '0' : '1');
      } catch {
        /* storage unavailable */
      }
      return !c;
    });

  return (
    <>
      <div className="kpi-head">
        <span className="kpi-label">
          <LayoutGrid />
          Summary
        </span>
        <button type="button" className="kpi-toggle" aria-expanded={!collapsed} onClick={toggle}>
          <span className="t">{collapsed ? 'Show' : 'Hide'}</span>
          {collapsed ? <ChevronDown /> : <ChevronUp />}
        </button>
      </div>
      {collapsed ? (
        <div className="kpi-strip" style={{ marginBottom: 20, ...style }}>
          {cards.map((c, i) => (
            <span key={i} className={`kpi-pill${c.type === AlertCard && c.props.value > 0 ? ' is-alert' : ''}`}>
              {c.props.title}
              <b>{c.props.pill ?? fmt(c.props.value)}</b>
            </span>
          ))}
        </div>
      ) : (
        <div className={`grid grid-${columns}`} style={{ marginBottom: 20, ...style }}>
          {children}
        </div>
      )}
    </>
  );
}
