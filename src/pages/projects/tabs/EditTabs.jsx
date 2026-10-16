import { useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Link as LinkIcon, Lock, Plus, Send, Trash2, UserPlus } from 'lucide-react';
import { projectsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { AmountInput } from '@/components/ui/AmountInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { ErrorAlert } from '@/components/ui/Display';
import { Dropdown } from '@/components/ui/Dropdown';
import { Checkbox, Field, IconInput } from '@/components/ui/Field';
import { useToast } from '@/components/ui/toast-context';
import { useCurrencyOptions, useMasterOptions } from '@/hooks/useOptions';
import { formatDate, formatNumber } from '@/lib/format';
import { blockNonNumericKeys, keepPercentInRange, num, rememberValue } from '@/lib/percent';
import { ACCESS, AccessTiles, ColorDot, CommentsLog, GradeTag, MemberCell, ReviewGrid } from './shared';
import { memberSub } from './ViewTabs';

const round2 = (n) => Math.round(n * 100) / 100;
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function PercentBox({ value, onChange, style, inputStyle }) {
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

export function ProjectFields({ control, register, errors, isEdit, startDate }) {
  const currency = useWatch({ control, name: 'estimatedAmountCurrency' });
  const customers = useMasterOptions('customers');
  const owners = useMasterOptions('users');
  const divisions = useMasterOptions('project-divisions');
  const types = useMasterOptions('project-types');
  const currencies = useCurrencyOptions();
  const err = (name) => errors[name]?.message;
  const select = (name, placeholder, options, clearable) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Dropdown search clearable={clearable} placeholder={placeholder} options={options} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
      )}
    />
  );
  return (
    <div className="form-grid">
      <Field label="Project title" required span={2} error={err('title')} htmlFor="title">
        <input id="title" className="input" placeholder="Enter title" {...register('title')} />
      </Field>
      <Field label="Customer" error={err('customerId')}>
        {select('customerId', 'Select customer', customers.options, true)}
      </Field>
      <Field label="Project owner" required error={err('ownerId')} help="project owner (a person)">
        {select('ownerId', 'Select project owner', owners.options)}
      </Field>
      <Field label="Project division" required error={err('projectDivisionId')} help="Web or Software">
        {select('projectDivisionId', 'Select project division', divisions.options)}
      </Field>
      <Field
        label="Project type"
        required
        error={err('projectTypeId')}
        help={isEdit ? 'changing the type does not re-create tasks' : "tasks are created from this project type's task template"}
      >
        {select('projectTypeId', 'Select project type', types.options)}
      </Field>
      <Field label="Start date" required error={err('startDate')}>
        <Controller
          name="startDate"
          control={control}
          render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} onBlur={field.onBlur} clearable={false} placeholder="Select start date" />}
        />
      </Field>
      <Field label="End date" error={err('endDate')}>
        <Controller
          name="endDate"
          control={control}
          render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} onBlur={field.onBlur} min={startDate || undefined} placeholder="Select end date" />}
        />
      </Field>
      <Field label="Total estimate amount" error={err('estimatedAmount')}>
        <Controller
          name="estimatedAmount"
          control={control}
          render={({ field }) => <AmountInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} currency={currency} />}
        />
      </Field>
      <Field label="Currency" error={err('estimatedAmountCurrency')}>
        <Controller
          name="estimatedAmountCurrency"
          control={control}
          render={({ field }) => <Dropdown placeholder="Select currency" options={currencies} value={field.value} onChange={field.onChange} />}
        />
      </Field>
      <Field label="SharePoint link" error={err('sharepointLink')}>
        <IconInput icon={LinkIcon} type="url" placeholder="https://" {...register('sharepointLink')} />
      </Field>
      <Field style={{ justifyContent: 'flex-end' }} help="retainer = ongoing support billed periodically; otherwise a fixed-scope project">
        <Controller
          name="isRetainerProject"
          control={control}
          render={({ field }) => <Checkbox label="Retainer project" checked={field.value} onChange={field.onChange} />}
        />
      </Field>
      <Field label="Detail" span="all" error={err('detail')}>
        <textarea className="textarea" placeholder="Add detail…" {...register('detail')} />
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ Update tab: add a review */

/** Reviews that hold % completed (progress table) and those with a comment (comments log). */
const progressReviews = (reviews) => reviews.filter((r) => r.groups.length > 0);
const commentReviews = (reviews) => reviews.filter((r) => r.comment);

/**
 * Update tab of the edit page: the progress table (stage + review date + a % column for the new
 * entry) and the comments card, where a comment can be added at any time.
 */
export function ReviewForm({ p, reviews, stages }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const progress = progressReviews(reviews);
  const comments = commentReviews(reviews);
  const latest = progress[0];
  const lastOf = (groupId) => latest?.groups.find((g) => g.taskGroupId === groupId)?.completionPercentage ?? 0;
  const [adding, setAdding] = useState(false); // the New entry column shows after "Add progress"
  const [stageId, setStageId] = useState(p.stageId);
  const [reviewDate, setReviewDate] = useState(todayIso);
  const [done, setDone] = useState(() => Object.fromEntries(p.estimates.map((e) => [e.taskGroupId, String(lastOf(e.taskGroupId))])));
  const [comment, setComment] = useState('');
  const [errs, setErrs] = useState({});
  const overall = Math.round(p.estimates.reduce((s, e) => s + (e.effortPercentage * num(done[e.taskGroupId])) / 100, 0));
  const stageName = stages.find((s) => s.value === stageId)?.label;

  const save = useMutation({
    mutationFn: ({ body }) => projectsApi.addReview(p.id, body),
    onSuccess: (list, { kind }) => {
      queryClient.setQueryData(['projects', p.id, 'reviews'], list);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(kind === 'comment' ? 'Comment added' : 'Progress added');
      if (kind === 'comment') setComment('');
      setErrs({});
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const addProgress = () => {
    const e = {};
    if (!stageId) e.stageId = 'Select the stage';
    if (!reviewDate) e.reviewDate = 'Select the review date';
    setErrs(e);
    if (Object.keys(e).length) return;
    // same stage and the same % as the last entry → nothing to add
    const unchanged = stageId === p.stageId && p.estimates.every((g) => num(done[g.taskGroupId]) === lastOf(g.taskGroupId));
    if (unchanged) {
      toast.warning('Nothing has changed in the progress – update the stage or a % before saving.');
      return;
    }
    save.mutate({
      kind: 'progress',
      body: {
        stageId,
        reviewDate,
        completion: p.estimates.map((g) => ({ taskGroupId: g.taskGroupId, completionPercentage: num(done[g.taskGroupId]) })),
      },
    });
  };

  const addComment = () => {
    if (!comment.trim()) {
      setErrs({ comment: 'Write a comment first' });
      return;
    }
    save.mutate({ kind: 'comment', body: { comment: comment.trim(), reviewDate: todayIso() } });
  };

  const entry = {
    head: (
      <>
        <div>New entry</div>
        <span className="rv-stage">
          {stageName ?? 'No stage'} · {reviewDate ? formatDate(reviewDate) : 'no date'}
        </span>
      </>
    ),
    cell: (groupId) => (
      <PercentBox value={done[groupId]} onChange={(val) => setDone((d) => ({ ...d, [groupId]: val }))} style={{ width: 96, margin: '0 auto' }} />
    ),
    total: <b>{overall}%</b>,
  };

  return (
    <div className="rv-layout">
      <section className="card card-lg form-card" style={{ marginTop: 16 }}>
        <div className="fc-head">
          <div>
            <div className="form-section-title">Progress by task group</div>
            <div className="form-section-sub">
              {adding
                ? `Pick the stage and review date, enter the % completed in the New entry column${latest ? ' (pre-filled with the last entry)' : ''}, then save.`
                : '% completed per task group at each entry, newest first.'}
            </div>
          </div>
          {!adding && p.estimates.length > 0 && (
            <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setAdding(true)}>
              <Plus />
              Add progress
            </button>
          )}
        </div>
        {adding && (
          <div className="rv-entry-bar">
            <Field label="Stage" required error={errs.stageId}>
              <Dropdown search placeholder="Select stage" options={stages} value={stageId} onChange={setStageId} />
            </Field>
            <Field label="Review date" required error={errs.reviewDate}>
              <DatePicker value={reviewDate} onChange={setReviewDate} clearable={false} max={todayIso()} placeholder="Select review date" />
            </Field>
            <div className="row" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setAdding(false);
                  setErrs({});
                }}
                disabled={save.isPending}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={addProgress} disabled={save.isPending}>
                <Check />
                {save.isPending ? 'Saving…' : 'Save progress'}
              </button>
            </div>
          </div>
        )}
        {p.estimates.length === 0 ? (
          <p className="muted small">Set the effort split on the Estimate tab to track the % completed per task group.</p>
        ) : adding || progress.length > 0 ? (
          <ReviewGrid reviews={progress} estimates={p.estimates} entry={adding ? entry : undefined} />
        ) : (
          <p className="muted small">No progress entered yet – click Add progress to record the first entry.</p>
        )}
        {progress.length > 0 && (
          <div className="muted small" style={{ marginTop: 10 }}>
            {progress.length} entr{progress.length === 1 ? 'y' : 'ies'}, newest first
          </div>
        )}
      </section>
      <section className="card card-lg form-card" style={{ marginTop: 16 }}>
        <div className="fc-head">
          <div>
            <div className="form-section-title">Comments</div>
            <div className="form-section-sub">Add a comment any time · latest first</div>
          </div>
        </div>
        <Field error={errs.comment}>
          <textarea
            className="textarea"
            rows={3}
            maxLength={5000}
            placeholder="What changed since the last update?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end', margin: '10px 0 16px' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addComment} disabled={save.isPending}>
            <Send />
            Add comment
          </button>
        </div>
        <CommentsLog reviews={comments} />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ Users tab */

let rowKey = 0;
export const memberRow = (m) => ({ key: `m${(rowKey += 1)}`, ...m, costPerHour: m.costPerHour != null ? String(m.costPerHour) : '' });

export function MembersEditor({ value, onChange, users, currency, error }) {
  const update = (key, patch) => onChange(value.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  const taken = new Set(value.map((m) => m.userId).filter(Boolean));
  const symbol = new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR' }).formatToParts(0).find((x) => x.type === 'currency')?.value;

  return (
    <section className="card card-lg form-card" style={{ marginTop: 16 }}>
      <div className="fc-head">
        <div>
          <div className="form-section-title">Project members</div>
          <div className="form-section-sub">Who works on this project and what they can see or do. Cost per hour is optional. People who have logged time cannot be removed.</div>
        </div>
      </div>
      <AccessTiles />
      <ErrorAlert>{error}</ErrorAlert>
      <div className="editor">
        <div className="table-wrap" style={{ borderTop: 0 }}>
          <table className="data-table members-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Grade</th>
                <th>Cost per hour</th>
                <th>Access</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {value.map((m) => {
                const locked = m.isOwner || m.loggedHours > 0;
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
                              update(m.key, { userId: id, name: u?.name, gradeName: u?.gradeName, teamName: u?.teamName, position: u?.position });
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
                    <td>
                      <GradeTag grade={m.gradeName} team={m.teamName} />
                    </td>
                    <td>
                      <div className="input-group cost-input">
                        <span className="lead">{symbol}</span>
                        <input
                          className="input has-trail"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Not set"
                          value={m.costPerHour}
                          onKeyDown={blockNonNumericKeys}
                          onChange={(e) => update(m.key, { costPerHour: e.target.value })}
                        />
                        <span className="trail">/hr</span>
                      </div>
                    </td>
                    <td>
                      <div className="segmented access-seg">
                        {Object.entries(ACCESS).map(([level, a]) => (
                          <button
                            key={level}
                            type="button"
                            data-level={level}
                            className={m.accessLevel === level ? 'is-active' : ''}
                            title={m.isOwner && level !== 'edit' ? 'The project owner always can edit' : a.desc}
                            disabled={m.isOwner && level !== 'edit'}
                            onClick={() => update(m.key, { accessLevel: level })}
                          >
                            <a.icon />
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="col-actions">
                      {locked ? (
                        <span className="icon-btn is-locked" title={m.isOwner ? 'Project owner – change the owner on the Project tab' : 'Has logged time – cannot be removed'}>
                          <Lock />
                        </span>
                      ) : (
                        <button type="button" className="icon-btn" title="Remove member" onClick={() => onChange(value.filter((x) => x.key !== m.key))}>
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
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange([...value, memberRow({ isNew: true, userId: undefined, accessLevel: 'view', loggedHours: 0 })])}>
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

export function EstimateEditor({ value, onChange, totalHours, hoursField, error }) {
  const total = round2(value.reduce((s, e) => s + num(e.effortPercentage), 0));
  const hours = totalHours === '' || totalHours == null ? null : num(totalHours);
  const ok = total === 100 || total === 0;
  return (
    <section className="card card-lg form-card" style={{ marginTop: 16 }}>
      <div className="fc-head">
        <div>
          <div className="form-section-title">Estimate</div>
          <div className="form-section-sub">Give the % of effort for each task group. If the total hours are known, the hours per group are calculated.</div>
        </div>
      </div>
      <div className="form-grid" style={{ marginBottom: 18 }}>
        <Field label="Total estimated hours" help="Optional – leave empty if the total is not known yet." error={hoursField.error}>
          <div className="input-group">
            <input className="input has-trail" type="number" min="0" step="0.5" placeholder="Not known yet" onKeyDown={blockNonNumericKeys} {...hoursField.props} />
            <span className="trail">hrs</span>
          </div>
        </Field>
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
                  </span>
                </td>
                <td>
                  <PercentBox
                    value={e.effortPercentage}
                    onChange={(v) => onChange(value.map((x) => (x.taskGroupId === e.taskGroupId ? { ...x, effortPercentage: v } : x)))}
                    inputStyle={{ textAlign: 'right', paddingRight: 40 }}
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
