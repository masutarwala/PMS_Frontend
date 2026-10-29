import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Lock } from 'lucide-react';
import { projectsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { AmountInput } from '@/components/ui/AmountInput';
import { Field } from '@/components/ui/Field';
import { useToast } from '@/components/ui/toast-context';
import { formatNumber } from '@/lib/format';
import { GradeTag, MemberCell } from './shared';

/*
 * Commercial tab – for the roles that have it (Roles & Permissions → Project access). Total project value (the project's total amount), outsource / purchase / other values
 * and every member's cost per hour and value (logged hours × rate). A member without a project rate
 * uses their grade's cost per hour (else their own rate). Net value = project value − total cost.
 */

const str = (v) => (v == null ? '' : String(v));
const num = (v) => (v === '' || v == null ? null : Number(v));
const round = (n) => Math.round(n * 1e6) / 1e6;
/** Rate used when no project rate is entered: the cost of the member's grade (Resource Grade & Cost). */
const fallbackOf = (m) => (m.gradeRate != null ? { rate: m.gradeRate, source: m.gradeRateViaUsd ? 'grade rate via USD' : 'grade rate' } : null);

export function CommercialTab({ p, canEdit }) {
  const c = p.commercial;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [values, setValues] = useState(() => ({ outsourceValue: str(c.outsourceValue), purchaseValue: str(c.purchaseValue), otherValue: str(c.otherValue) }));
  const [rates, setRates] = useState(() => Object.fromEntries(c.members.map((m) => [m.id, str(m.costPerHour)])));
  const cur = c.currency;

  // live figures while editing
  const members = c.members.map((m) => {
    const fb = fallbackOf(m);
    const own = num(rates[m.id]);
    const rate = own ?? fb?.rate ?? null;
    return { ...m, fallback: fb, rate, source: own != null ? null : fb?.source, value: rate != null ? round(m.loggedHours * rate) : null };
  });
  const membersValue = round(members.reduce((s, m) => s + (m.value ?? 0), 0));
  const totalCost = round(membersValue + (num(values.outsourceValue) ?? 0) + (num(values.purchaseValue) ?? 0) + (num(values.otherValue) ?? 0));
  const netValue = c.totalValue != null ? round(c.totalValue - totalCost) : null;
  const netPct = c.totalValue ? Math.round((netValue / c.totalValue) * 10000) / 100 : null;

  const changed =
    ['outsourceValue', 'purchaseValue', 'otherValue'].some((k) => num(values[k]) !== (c[k] ?? null)) || c.members.some((m) => num(rates[m.id]) !== (m.costPerHour ?? null));

  const save = useMutation({
    mutationFn: (body) => projectsApi.updateCommercial(p.id, body),
    onSuccess: (saved) => {
      queryClient.setQueryData(['projects', String(p.id)], saved);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Commercial values saved');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const onSave = () => {
    if (!changed) {
      toast.warning('Nothing has changed.');
      return;
    }
    save.mutate({
      outsourceValue: num(values.outsourceValue),
      purchaseValue: num(values.purchaseValue),
      otherValue: num(values.otherValue),
      members: c.members.map((m) => ({ userId: m.id, costPerHour: num(rates[m.id]) })),
    });
  };

  const reset = () => {
    setValues({ outsourceValue: str(c.outsourceValue), purchaseValue: str(c.purchaseValue), otherValue: str(c.otherValue) });
    setRates(Object.fromEntries(c.members.map((m) => [m.id, str(m.costPerHour)])));
  };
  const plain = (v) => new Intl.NumberFormat(cur === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v ?? 0);
  const fixed = (v) => (v == null ? '—' : `${cur} ${plain(v)}`);

  // where the cost goes
  const parts = [
    { key: 'members', label: 'Members', sub: 'logged hours × rate', value: membersValue, color: 'var(--green-800)' },
    { key: 'outsource', label: 'Outsource', value: num(values.outsourceValue) ?? 0, color: 'var(--green-600)' },
    { key: 'purchase', label: 'Purchase', value: num(values.purchaseValue) ?? 0, color: 'var(--green-300)' },
    { key: 'others', label: 'Others', value: num(values.otherValue) ?? 0, color: 'var(--border-strong, #D4D9D6)' },
  ];
  const share = (v) => (totalCost ? Math.round((v / totalCost) * 1000) / 10 : 0);
  const negative = netValue != null && netValue < 0;

  const costField = (key, label, help) => (
    <Field label={label} help={help}>
      {canEdit ? (
        <div className="input-group cm-amount">
          <span className="cm-cur">{cur}</span>
          <AmountInput value={values[key]} onChange={(v) => setValues((s) => ({ ...s, [key]: v }))} currency={cur} placeholder="0" />
        </div>
      ) : (
        <b style={{ fontSize: 15 }}>{fixed(c[key])}</b>
      )}
    </Field>
  );

  return (
    <>
      <div className="card card-lg cm-card" style={{ marginTop: 16 }}>
        <div className="row between" style={{ gap: 12, alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <h3 className="cm-title">Commercial</h3>
            <div className="muted small">
              Project value against what it costs. All amounts in {cur}, the project&apos;s currency. A member whose grade has no cost in {cur} is costed in USD and converted
              {c.projectCurrency !== 'USD' && c.usdRate != null && (
                <>
                  {' '}
                  at 1 {c.projectCurrency} = {c.usdRate} USD (Parameters → USD Rates)
                </>
              )}
              .
            </div>
          </div>
          <span className="cm-pill">
            <Lock />
            Restricted by role
          </span>
        </div>

        {c.missingRates?.length > 0 && (
          <div className="alert alert-warning" style={{ marginBottom: 16 }}>
            No USD rate for {c.missingRates.join(', ')} – add it in Administration → Parameters → USD Rates. Costs that need {c.missingRates.length > 1 ? 'these currencies' : 'this currency'} to be converted to {cur} are left out until then.
          </div>
        )}

        <div className="cm-panels">
          <div className={`cm-net${negative ? ' is-negative' : ''}`}>
            <span className="small">Net value</span>
            <div className="cm-net-value">{fixed(netValue)}</div>
            <div className="row" style={{ gap: 8, marginTop: 6 }}>
              {netPct != null && <span className="cm-badge">{formatNumber(netPct)}% margin</span>}
              <span className="muted small">{c.totalValue == null ? 'set the total amount on the Project tab' : 'of the project value'}</span>
            </div>
            <div className="cm-bar">
              <span style={{ width: `${Math.max(0, Math.min(100, netPct ?? 0))}%` }} />
            </div>
            <div className="cm-lines">
              <span>Project value</span>
              <b>{fixed(c.totalValue)}</b>
              <span>Total cost</span>
              <b>− {fixed(totalCost)}</b>
            </div>
          </div>

          <div className="cm-cost">
            <div className="row between" style={{ marginBottom: 12 }}>
              <span className="small" style={{ fontWeight: 600 }}>
                Where the cost goes
              </span>
              <b style={{ fontSize: 17 }}>{fixed(totalCost)}</b>
            </div>
            <div className="cm-stack">
              {parts
                .filter((x) => x.value > 0)
                .map((x) => (
                  <span key={x.key} style={{ width: `${share(x.value)}%`, background: x.color }} title={`${x.label} ${share(x.value)}%`} />
                ))}
            </div>
            <ul className="cm-legend">
              {parts.map((x) => (
                <li key={x.key}>
                  <i style={{ background: x.color }} />
                  <span>
                    {x.label}
                    {x.sub && <small> · {x.sub}</small>}
                  </span>
                  <b>{plain(x.value)}</b>
                  <em>{share(x.value)}%</em>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="cm-edit">
          <div className="form-section-title" style={{ fontSize: 14, marginBottom: 12 }}>
            {canEdit ? 'Edit costs' : 'Costs'}
          </div>
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {costField('outsourceValue', 'Outsource', 'Work given to vendors')}
            {costField('purchaseValue', 'Purchase', 'Licences, hardware and similar')}
            {costField('otherValue', 'Others', 'Any other cost')}
          </div>
          {canEdit && (
            <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={reset} disabled={!changed || save.isPending}>
                Reset
              </button>
              <button type="button" className="btn btn-primary" onClick={onSave} disabled={save.isPending}>
                <Check />
                {save.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card card-flush" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <h3>Members value</h3>
            <div className="sub">Cost per hour on this project – empty uses the cost of the member&apos;s grade – and the value of the hours they logged.</div>
          </div>
        </div>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Grade</th>
                <th className={canEdit ? undefined : 'right'}>Cost per hour</th>
                <th className="right">Logged</th>
                <th className="right">Value</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <MemberCell name={m.name} sub={m.isOwner ? 'Project owner' : undefined} />
                  </td>
                  <td>
                    <GradeTag grade={m.gradeName} team={m.teamName} />
                  </td>
                  <td className={canEdit ? undefined : 'num right'} style={canEdit ? { width: 210 } : undefined}>
                    {canEdit ? (
                      <div className="input-group">
                        <AmountInput
                          className="has-trail"
                          value={rates[m.id]}
                          onChange={(v) => setRates((r) => ({ ...r, [m.id]: v }))}
                          currency={cur}
                          placeholder={m.fallback ? `${formatNumber(m.fallback.rate)} · ${m.fallback.source.replace(' rate', '')}` : 'Not set'}
                        />
                        <span className="trail">/hr</span>
                      </div>
                    ) : m.rate != null ? (
                      <>
                        {fixed(m.rate)}
                        <span className="muted"> /hr</span>
                        {m.source && <span className="muted small"> · {m.source}</span>}
                      </>
                    ) : (
                      <span className="muted">Not set</span>
                    )}
                  </td>
                  <td className="num right">{formatNumber(m.loggedHours)}h</td>
                  <td className="num right">
                    <b>{fixed(m.value)}</b>
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'var(--surface-2)' }}>
                <td colSpan={3}>
                  <b>All members ({members.length})</b>
                </td>
                <td className="num right">
                  <b>{formatNumber(round(members.reduce((s, m) => s + m.loggedHours, 0)))}h</b>
                </td>
                <td className="num right">
                  <b>{fixed(membersValue)}</b>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div className="row" style={{ justifyContent: 'flex-end', padding: '14px 20px 18px' }}>
            <button type="button" className="btn btn-primary" onClick={onSave} disabled={save.isPending}>
              <Check />
              {save.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
