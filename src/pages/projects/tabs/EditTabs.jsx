import { useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Link as LinkIcon, Lock, Trash2, UserPlus } from 'lucide-react';
import { mastersApi, projectsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { AmountInput } from '@/components/ui/AmountInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { ErrorAlert } from '@/components/ui/Display';
import { Dropdown } from '@/components/ui/Dropdown';
import { Checkbox, Field, IconInput } from '@/components/ui/Field';
import { useToast } from '@/components/ui/toast-context';
import { useConfirm } from '@/components/ui/confirm-context';
import { useCurrencyOptions, useMasterOptions, useStageOptions } from '@/hooks/useOptions';
import { Spinner } from '@/components/ui/Loader';
import { formatDate, formatNumber } from '@/lib/format';
import { blockNonNumericKeys, keepPercentInRange, num, rememberValue } from '@/lib/percent';
import { ColorDot, CommentsLog, MemberCell, ReviewGrid } from './shared';
import { EstimateTotals, memberSub, quotedHours } from './ViewTabs';
import { todayIso } from '@/lib/timezone';

const round2 = (n) => Math.round(n * 100) / 100;

export function PercentBox({ value, onChange, style, inputStyle }) {
  return (
    <div className="input-group" style={style}>
      <input
        className="input has-trail"
        type="number"
        min="0"
        max="100"
        step="0.5"
        inputMode="decimal"
        placeholder="0"
        value={value}
        onKeyDown={blockNonNumericKeys}
        onFocus={rememberValue}
        onInput={keepPercentInRange}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
      <span className="trail">%</span>
    </div>
  );
}

/* ------------------------------------------------------------------ Project tab (also the New project form) */

/**
 * `access(key)` → 'hidden' | 'view' | 'edit' per field (Roles & Permissions → Project access): hidden
 * fields are left out, view fields are read-only.
 */
export function ProjectFields({ control, register, errors, isEdit, startDate, getValues, setValue, access = () => 'edit' }) {
  const show = (key) => access(key) !== 'hidden';
  const ro = (key) => access(key) === 'view';
  const currency = useWatch({ control, name: 'estimatedAmountCurrency' });
  const customers = useMasterOptions('customers');
  const owners = useMasterOptions('users');
  const divisions = useMasterOptions('project-divisions');
  const typesQ = useQuery({ queryKey: ['masters', 'project-types'], queryFn: () => mastersApi.list('project-types'), staleTime: 5 * 60 * 1000 });
  const divisionId = useWatch({ control, name: 'projectDivisionId' });
  // project types belong to a division: offer only the chosen division's types
  const typeOptions = (typesQ.data ?? []).filter((t) => !divisionId || t.divisionId === divisionId).map((t) => ({ value: t.id, label: t.name }));
  const currencies = useCurrencyOptions();
  const err = (name) => errors[name]?.message;
  const select = (name, placeholder, options, clearable) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Dropdown search clearable={clearable && !ro(name)} placeholder={placeholder} options={options} value={field.value} onChange={field.onChange} onBlur={field.onBlur} disabled={ro(name)} />
      )}
    />
  );
  return (
    <div className="form-grid">
      <Field label="Project title" required span={2} error={err('title')} htmlFor="title">
        <input id="title" className="input" placeholder="Enter title" readOnly={ro('title')} {...register('title')} />
      </Field>
      {show('customerId') && (
        <Field label="Customer" error={err('customerId')}>
          {select('customerId', 'Select customer', customers.options, true)}
        </Field>
      )}
      <Field label="Project owner" required error={err('ownerId')} help="project owner (a person)">
        {select('ownerId', 'Select project owner', owners.options)}
      </Field>
      <Field label="Project division" required error={err('projectDivisionId')} help="Web or Software">
        <Controller
          name="projectDivisionId"
          control={control}
          render={({ field }) => (
            <Dropdown
              search
              placeholder="Select project division"
              options={divisions.options}
              value={field.value}
              onChange={(v) => {
                field.onChange(v);
                // a type of another division no longer fits
                const t = (typesQ.data ?? []).find((x) => x.id === getValues('projectTypeId'));
                if (t && t.divisionId !== v) setValue('projectTypeId', undefined);
              }}
              onBlur={field.onBlur}
              disabled={ro('projectDivisionId')}
            />
          )}
        />
      </Field>
      <Field
        label="Project type"
        required
        error={err('projectTypeId')}
        help={isEdit ? 'changing the type does not re-create tasks' : "tasks are created from this project type's task template"}
      >
        {select('projectTypeId', 'Select project type', typeOptions)}
      </Field>
      <Field label="Start date" required error={err('startDate')}>
        <Controller
          name="startDate"
          control={control}
          render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} onBlur={field.onBlur} clearable={false} placeholder="Select start date" disabled={ro('startDate')} />}
        />
      </Field>
      {show('endDate') && (
        <Field label="End date" error={err('endDate')}>
          <Controller
            name="endDate"
            control={control}
            render={({ field }) => (
              <DatePicker value={field.value} onChange={field.onChange} onBlur={field.onBlur} min={startDate || undefined} placeholder="Select end date" disabled={ro('endDate')} />
            )}
          />
        </Field>
      )}
      {show('estimatedAmount') && (
        <Field label="Total amount" error={err('estimatedAmount')}>
          <Controller
            name="estimatedAmount"
            control={control}
            render={({ field }) => <AmountInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} currency={currency} readOnly={ro('estimatedAmount')} />}
          />
        </Field>
      )}
      {show('estimatedAmountCurrency') && (
        <Field label="Currency" error={err('estimatedAmountCurrency')}>
          <Controller
            name="estimatedAmountCurrency"
            control={control}
            render={({ field }) => <Dropdown placeholder="Select currency" options={currencies} value={field.value} onChange={field.onChange} disabled={ro('estimatedAmountCurrency')} />}
          />
        </Field>
      )}
      {show('sharepointLink') && (
        <Field label="SharePoint link" error={err('sharepointLink')}>
          <IconInput icon={LinkIcon} type="url" placeholder="https://" readOnly={ro('sharepointLink')} {...register('sharepointLink')} />
        </Field>
      )}
      {show('isRetainerProject') && (
        <Field style={{ justifyContent: 'flex-end' }} help="retainer = ongoing support billed periodically; otherwise a fixed-scope project">
          <Controller
            name="isRetainerProject"
            control={control}
            render={({ field }) => <Checkbox label="Retainer project" checked={field.value} onChange={field.onChange} disabled={ro('isRetainerProject')} />}
          />
        </Field>
      )}
      {show('isBillable') && (
        <Field style={{ justifyContent: 'flex-end' }} help="time logged on this project counts as billable">
          <Controller
            name="isBillable"
            control={control}
            render={({ field }) => <Checkbox label="Billable project" checked={field.value} onChange={field.onChange} disabled={ro('isBillable')} />}
          />
        </Field>
      )}
      {show('detail') && (
        <Field label="Detail" span="all" error={err('detail')}>
          <textarea className="textarea" placeholder="Add detail…" readOnly={ro('detail')} {...register('detail')} />
        </Field>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Update tab */

/** Reviews that hold % completed (progress table) and the log entries (comments + system logs). */
export const progressReviews = (reviews) => reviews.filter((r) => r.groups.length > 0);
// the log is in the order things were written (newest first), whatever their stage date
export const logEntries = (reviews) => reviews.filter((r) => r.comment).sort((a, b) => b.id - a.id);

/**
 * Update tab (details page and edit page): one step to update the project.
 *   left  – progress by task group: the New entry column (pre-filled with the latest %) + the last 2 updates
 *   right – stage + stage date, a comment and the last 3 log entries
 * "Save update" saves whatever changed: progress, stage (the system logs the change) and / or the comment.
 */
export function UpdatePanel({ p, reviews, stages, canEdit, onShowLogs }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const progress = progressReviews(reviews);
  const logs = logEntries(reviews);
  const latest = progress[0];
  const lastOf = (groupId) => latest?.groups.find((g) => g.taskGroupId === groupId)?.completionPercentage ?? 0;
  const [stageId, setStageId] = useState(p.stageId);
  const [stageDate, setStageDate] = useState(todayIso);
  const [done, setDone] = useState(() => Object.fromEntries(p.estimates.map((e) => [e.taskGroupId, String(lastOf(e.taskGroupId))])));
  const [comment, setComment] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [errs, setErrs] = useState({});
  const overall = Math.round(p.estimates.reduce((s, e) => s + (e.effortPercentage * num(done[e.taskGroupId])) / 100, 0));
  const stageName = stages.find((s) => s.value === stageId)?.label;
  const progressChanged = p.estimates.some((g) => num(done[g.taskGroupId]) !== lastOf(g.taskGroupId));
  const stageChanged = stageId !== p.stageId;

  const save = useMutation({
    mutationFn: (body) => projectsApi.addReview(p.id, body),
    onSuccess: (list) => {
      queryClient.setQueryData(['projects', p.id, 'reviews'], list);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      // project people / status feed the task and timesheet forms (who can be assigned, what can be logged)
      queryClient.invalidateQueries({ queryKey: ['tasks', 'options'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Project updated');
      setComment('');
      setErrs({});
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const saveUpdate = () => {
    if (!stageDate) {
      setErrs({ stageDate: 'Select the stage date' });
      return;
    }
    if (!progressChanged && !stageChanged && !comment.trim()) {
      toast.warning('Nothing has changed – update a %, the stage or write a comment.');
      return;
    }
    save.mutate({
      reviewDate: stageDate,
      ...(stageChanged ? { stageId } : {}),
      ...(comment.trim() ? { comment: comment.trim() } : {}),
      ...(progressChanged ? { completion: p.estimates.map((g) => ({ taskGroupId: g.taskGroupId, completionPercentage: num(done[g.taskGroupId]) })) } : {}),
    });
  };

  const shown = showAll ? progress : progress.slice(0, 2);
  const entry = canEdit && {
    head: (
      <>
        <div>New entry</div>
        <span className="rv-stage">
          {stageName ?? 'No stage'} · {stageDate ? formatDate(stageDate) : 'no date'}
        </span>
      </>
    ),
    cell: (groupId) => <PercentBox value={done[groupId]} onChange={(val) => setDone((d) => ({ ...d, [groupId]: val }))} style={{ width: 96, margin: '0 auto' }} />,
    total: <b>{overall}%</b>,
  };
  const saveButton = (
    <button type="button" className="btn btn-primary" onClick={saveUpdate} disabled={save.isPending}>
      <Check />
      {save.isPending ? 'Saving…' : 'Save update'}
    </button>
  );

  return (
    <div className="rv-layout">
      <section className="card card-lg form-card" style={{ marginTop: 16 }}>
        <div className="fc-head">
          <div>
            <div className="form-section-title">Progress by task group</div>
            <div className="form-section-sub">
              {canEdit ? `Enter the % completed in the New entry column${latest ? ' (pre-filled with the last update)' : ''}.` : '% completed per task group, newest first.'}
            </div>
          </div>
        </div>
        {p.estimates.length === 0 ? (
          <p className="muted small">Set the effort split on the Estimate tab to track the % completed per task group.</p>
        ) : entry || progress.length > 0 ? (
          <ReviewGrid reviews={shown} estimates={p.estimates} entry={entry || undefined} />
        ) : (
          <p className="muted small">No progress entered yet.</p>
        )}
        {(progress.length > 2 || (canEdit && p.estimates.length > 0)) && (
          <div className="row between" style={{ marginTop: 12, gap: 12, flexWrap: 'wrap' }}>
            {progress.length > 2 ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show the last 2 updates' : `Show all ${progress.length} updates`}
              </button>
            ) : (
              <span />
            )}
            {canEdit && p.estimates.length > 0 && saveButton}
          </div>
        )}
      </section>

      <section className="card card-lg form-card" style={{ marginTop: 16 }}>
        {canEdit && (
          <>
            <div className="fc-head">
              <div>
                <div className="form-section-title">Stage</div>
                <div className="form-section-sub">A stage change is added to the log automatically.</div>
              </div>
            </div>
            <div className="form-grid rv-stage-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10, marginBottom: 14 }}>
              <Field label="Stage" required>
                <Dropdown search placeholder="Select stage" options={stages} value={stageId} onChange={setStageId} />
              </Field>
              <Field label="Stage date" required error={errs.stageDate}>
                <DatePicker value={stageDate} onChange={setStageDate} clearable={false} max={todayIso()} placeholder="Select date" />
              </Field>
            </div>
            <Field label="Comment">
              <textarea
                className="textarea"
                rows={3}
                maxLength={5000}
                placeholder="What changed since the last update?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </Field>
            <div className="row" style={{ justifyContent: 'flex-end', margin: '12px 0 18px' }}>
              {saveButton}
            </div>
          </>
        )}
        <div className="row between" style={{ marginBottom: 10 }}>
          <div className="form-section-title" style={{ fontSize: 14 }}>
            Comments &amp; logs
          </div>
          {logs.length > 3 && onShowLogs && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onShowLogs}>
              View all {logs.length}
            </button>
          )}
        </div>
        <CommentsLog reviews={logs.slice(0, 3)} />
      </section>
    </div>
  );
}

/** Update tab with its data: the reviews and the stage options. */
export function UpdateTab({ p, canEdit, onShowLogs }) {
  const stages = useStageOptions();
  const reviews = useQuery({ queryKey: ['projects', p.id, 'reviews'], queryFn: () => projectsApi.reviews(p.id) });
  if (reviews.isLoading) return <Spinner />;
  return <UpdatePanel key={`${p.id}-${p.estimates.length}`} p={p} reviews={reviews.data ?? []} stages={stages.options} canEdit={canEdit} onShowLogs={onShowLogs} />;
}

/* ------------------------------------------------------------------ Users tab */

let rowKey = 0;
export const memberRow = (m) => ({ key: `m${(rowKey += 1)}`, ...m });

export function MembersEditor({ projectId, value, onChange, users, error }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [checking, setChecking] = useState(null); // member being checked before removal
  // whether a saved member can leave (time logged / tasks) is asked only when they are removed
  const remove = async (m) => {
    const name = m.name || 'this person';
    if (!(await confirm({ title: 'Remove member?', message: `Remove ${name} from the project? It is saved when you click Save.`, confirmLabel: 'Remove' }))) return;
    if (m.isNew || !projectId) {
      onChange(value.filter((x) => x.key !== m.key));
      return;
    }
    setChecking(m.key);
    try {
      const r = await projectsApi.memberRemovable(projectId, m.userId);
      if (r.canRemove) onChange(value.filter((x) => x.key !== m.key));
      else toast.error(r.reason);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setChecking(null);
    }
  };
  const update = (key, patch) => onChange(value.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  const taken = new Set(value.map((m) => m.userId).filter(Boolean));

  return (
    <section className="card card-lg form-card" style={{ marginTop: 16 }}>
      <div className="fc-head">
        <div>
          <div className="form-section-title">Project members</div>
          <div className="form-section-sub">Who works on this project. Someone with logged time or tasks on it cannot be removed.</div>
        </div>
      </div>
      <ErrorAlert>{error}</ErrorAlert>
      <div className="editor">
        <div className="table-wrap" style={{ borderTop: 0 }}>
          <table className="data-table members-table">
            <thead>
              <tr>
                <th>Member</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {value.map((m) => {
                const locked = m.isOwner;
                return (
                  <tr key={m.key}>
                    <td style={{ minWidth: 220 }}>
                      {m.isNew ? (
                        <>
                          <Dropdown
                            search
                            placeholder="Select member"
                            options={users.filter((u) => u.id === m.userId || !taken.has(u.id)).map((u) => ({ value: u.id, label: u.name }))}
                            value={m.userId}
                            onChange={(id) => {
                              const u = users.find((x) => x.id === id);
                              update(m.key, { userId: id, name: u?.name, teamName: u?.teamName, position: u?.position });
                            }}
                          />
                          {m.position && (
                            <span className="pos-sub" style={{ margin: '6px 0 0 4px', display: 'block' }}>
                              {m.position}
                            </span>
                          )}
                        </>
                      ) : (
                        <MemberCell name={m.name} sub={memberSub(m)} />
                      )}
                    </td>
                    <td className="col-actions">
                      {locked ? (
                        <span className="icon-btn is-locked" title="Project owner – change the owner on the Project tab">
                          <Lock />
                        </span>
                      ) : (
                        <button type="button" className="icon-btn" title="Remove member" disabled={checking === m.key} onClick={() => remove(m)}>
                          <Trash2 />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="editor-foot">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange([...value, memberRow({ isNew: true, userId: undefined, loggedHours: 0 })])}>
            <UserPlus />
            Add member
          </button>
          <span className="muted small">
            {value.length} member{value.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Estimate tab */

export function EstimateEditor({ value, onChange, totalHours, hoursField, error, quote, onUseQuote }) {
  const total = round2(value.reduce((s, e) => s + num(e.effortPercentage), 0));
  // the quote (amount ÷ rate) is the default; the hours can always be changed
  const quoted = quotedHours(quote?.amount, quote?.rate);
  const hours = totalHours === '' || totalHours == null ? null : num(totalHours);
  const ok = total === 100 || total === 0;
  return (
    <section className="card card-lg form-card" style={{ marginTop: 16 }}>
      <div className="fc-head">
        <div>
          <div className="form-section-title">Estimate</div>
          <div className="form-section-sub">
            Give the % of effort for each task group. The total hours default to total amount ÷ the division&apos;s quote rate and can be changed; the hours per group are calculated from them.
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <EstimateTotals
          amount={quote?.amount}
          currency={quote?.currency}
          rate={quote?.rate}
          hoursInput={
            <Field
              label="Total estimated hours"
              help={quoted != null ? `quote: ${formatNumber(quoted)} hrs (total amount ÷ rate)` : 'no quote rate – enter the hours, or leave empty if not known yet'}
              error={hoursField.error}
            >
              <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                <div className="input-group" style={{ width: 170 }}>
                  <input className="input has-trail" type="number" min="0" step="0.5" placeholder={quoted != null ? String(quoted) : 'Not known yet'} onKeyDown={blockNonNumericKeys} {...hoursField.props} />
                  <span className="trail">hrs</span>
                </div>
                {quoted != null && hours !== quoted && (
                  <button type="button" className="btn btn-soft btn-sm" title="Set the hours to the quote" onClick={() => onUseQuote?.(quoted)}>
                    Use {formatNumber(quoted)}
                  </button>
                )}
              </div>
            </Field>
          }
        />
      </div>
      <div className="alloc-bar" style={{ marginBottom: 16 }}>
        {value.map((e, i) => (
          <span key={e.taskGroupId} className={`c${(i % 8) + 1}`} style={{ width: `${Math.min(100, num(e.effortPercentage))}%` }} />
        ))}
      </div>
      <div className="editor">
        <table className="data-table">
          <thead>
            <tr>
              <th>Task group</th>
              <th style={{ width: 170 }}>% of effort</th>
              <th className="right" style={{ width: 150 }}>
                Estimated hours
              </th>
            </tr>
          </thead>
          <tbody>
            {value.map((e, i) => (
              <tr key={e.taskGroupId}>
                <td>
                  <span className="row" style={{ gap: 10 }}>
                    <ColorDot i={i} />
                    <b>{e.taskGroupName}</b>
                    {e.locked && (
                      <span className="badge" title={`${e.lockReason} – the effort cannot be set to 0%`}>
                        <Lock style={{ width: 12, height: 12 }} />
                        Work started
                      </span>
                    )}
                  </span>
                </td>
                <td>
                  <PercentBox
                    value={e.effortPercentage}
                    onChange={(v) => onChange(value.map((x) => (x.taskGroupId === e.taskGroupId ? { ...x, effortPercentage: v } : x)))}
                    inputStyle={{ textAlign: 'right', paddingRight: 40, ...(e.locked && num(e.effortPercentage) <= 0 ? { borderColor: 'var(--danger)' } : {}) }}
                  />
                </td>
                <td className="right">
                  <b className="num" style={{ fontSize: 14 }}>
                    {hours != null ? `${formatNumber(round2((hours * num(e.effortPercentage)) / 100))} hrs` : '—'}
                  </b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="editor-foot">
          <span className={`small${ok ? ' muted' : ''}`} style={ok ? undefined : { color: 'var(--danger)', fontWeight: 600 }}>
            {error ?? (total === 100 ? 'Total is 100%' : total === 0 ? 'No effort split yet' : total > 100 ? `${round2(total - 100)}% over – reduce a value` : `${round2(100 - total)}% left to allocate`)}
          </span>
          <div className="editor-total">
            <span className={`badge ${total === 100 ? 'badge-success' : total === 0 ? '' : 'badge-danger'}`}>{formatNumber(total)}%</span>
            <span className="muted">Total</span>
            <span className="badge badge-dark">{hours != null ? `${formatNumber(round2((hours * total) / 100))} hrs` : '— hrs'}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
