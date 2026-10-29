import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Cloud,
  CalendarRange,
  CopyCheck,
  Infinity as InfinityIcon,
  LayoutTemplate,
  ListChecks,
  ListPlus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { tasksApi } from "@/api/endpoints";
import { errorMessage } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { Topbar } from "@/components/layout/Topbar";
import { DatePicker } from "@/components/ui/DatePicker";
import { TimePicker } from "@/components/ui/TimePicker";
import { EmptyState, ErrorAlert } from "@/components/ui/Display";
import { Dropdown } from "@/components/ui/Dropdown";
import { Checkbox, Field, Switch } from "@/components/ui/Field";
import { FullPageLoader, Spinner } from "@/components/ui/Loader";
import { Modal } from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/confirm-context";
import { useToast } from "@/components/ui/toast-context";
import { TASK_PRIORITY_OPTIONS } from "@/lib/constants";
import { blockNonNumericKeys } from "@/lib/percent";
import { todayIso, zonedToIso } from "@/lib/timezone";
import { formatMinutes } from "./TaskListPage";
import { formatDate } from "@/lib/format";
import { TaskPlanSection } from "./TaskPlanSection";

// people & plan copied into every new pick (and by "Apply to all")
const PLAN_KEYS = [
  "ownerId",
  "priority",
  "isContinuous",
  "startDate",
  "startTime",
  "endDate",
  "endTime",
];

/** "How do you want to add the tasks?" – from the project type's template, or from the project plan. */
function HowToAdd({ project, onPick }) {
  const n = project?.templateCount ?? 0;
  return (
    <div className="tp-choice">
      <button type="button" className="tp-opt" onClick={() => onPick("template")}>
        <span className="tp-opt-ico">
          <LayoutTemplate />
        </span>
        <span>
          <b>From the template</b>
          <small>
            Pick tasks from the {project?.projectTypeName ?? "project type"} template ({n} task{n === 1 ? "" : "s"})
          </small>
        </span>
      </button>
      <button type="button" className="tp-opt" onClick={() => onPick("plan")}>
        <span className="tp-opt-ico">
          <CalendarRange />
        </span>
        <span>
          <b>From the project plan</b>
          <small>One task for each planned task group, with its dates from the weekly plan</small>
        </span>
      </button>
    </div>
  );
}

/** Template task matches the picker search (title, type, group, skills). */
const matchesSearch = (t, search) =>
  !search ||
  `${t.title} ${t.taskTypeName} ${t.taskGroupName} ${t.skills.join(" ")}`
    .toLowerCase()
    .includes(search.trim().toLowerCase());

/** Problems of one picked task, or null. */
function rowError(r) {
  if (r.isContinuous) return null;
  if (!r.startDate) return "Select the earliest start";
  if (!r.endDate) return "Select the end before date";
  if (zonedToIso(r.endDate, r.endTime) <= zonedToIso(r.startDate, r.startTime))
    return "End before must be after the earliest start";
  return null;
}

/**
 * Add tasks from a project's template: pick an ongoing project, pick tasks of its project type's
 * template in a popup, then give each picked task its own people and plan (cards can be collapsed). The assignee is suggested from the
 * skills the task needs (project people with that skill, Users → Skills); defaults fill new rows.
 */
export default function TaskTemplatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const [projectId, setProjectId] = useState(null);
  const [defaults, setDefaults] = useState({
    ownerId: user.id,
    priority: "medium",
    isContinuous: false,
    startDate: todayIso(),
    startTime: "09:00",
    endDate: "",
    endTime: "18:00",
  });
  const [rows, setRows] = useState([]); // one per picked template task
  const [rowErrors, setRowErrors] = useState({}); // templateId → message
  const [projectError, setProjectError] = useState(null);
  const [mode, setMode] = useState(null); // null (not chosen yet) | "template" | "plan"
  const [choosing, setChoosing] = useState(false); // the "template or plan?" question is open
  const [picker, setPicker] = useState(null); // { draft: Set of templateIds, search } while the popup is open
  const [collapsed, setCollapsed] = useState(() => new Set()); // templateIds of collapsed task cards

  const options = useQuery({
    queryKey: ["tasks", "options"],
    queryFn: tasksApi.options,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: "always", // project members may have changed – the cached list shows meanwhile
  });
  const projects = useQuery({
    queryKey: ["tasks", "template-projects"],
    queryFn: tasksApi.templateProjects,
  });
  const templates = useQuery({
    queryKey: ["tasks", "templates", projectId],
    queryFn: () => tasksApi.projectTemplates(projectId),
    enabled: !!projectId,
  });

  const project = (projects.data ?? []).find((p) => p.id === projectId);
  const list = useMemo(() => templates.data ?? [], [templates.data]);
  const byGroup = useMemo(() => {
    const m = new Map();
    for (const t of list)
      m.set(t.taskGroupName, [...(m.get(t.taskGroupName) ?? []), t]);
    return [...m.entries()];
  }, [list]);
  const canAssign = options.data?.canAssignOthers ?? false;
  const users = options.data?.users ?? [];
  const userOptions = users.map((u) => ({ value: u.id, label: u.name }));

  // assignee: the best skill match on the project, else the signed-in user
  // (people with the skill are always on the project; otherwise the project owner)
  const suggested = (t) =>
    canAssign ? (t.matches[0]?.userId ?? project?.ownerId ?? user.id) : user.id;
  const newRow = (t) => ({
    templateId: t.id,
    ...Object.fromEntries(PLAN_KEYS.map((k) => [k, defaults[k]])),
    assignedTo: suggested(t),
    estH: t.estimatedMinutes ? String(Math.floor(t.estimatedMinutes / 60)) : "",
    estM: t.estimatedMinutes ? String(t.estimatedMinutes % 60) : "",
  });
  const setRow = (id, patch) => {
    setRows((l) =>
      l.map((r) => (r.templateId === id ? { ...r, ...patch } : r)),
    );
    setRowErrors((e) => ({ ...e, [id]: undefined }));
  };
  const removeRow = async (t) => {
    if (
      await confirm({
        title: "Remove task?",
        message: `"${t.title}" is removed from the picked tasks.`,
        confirmLabel: "Remove",
      })
    ) {
      setRows((l) => l.filter((r) => r.templateId !== t.id));
    }
  };

  // ---- picker popup: works on a draft; "Use tasks" keeps the settings of tasks already configured
  const openPicker = () =>
    setPicker({ draft: new Set(rows.map((r) => r.templateId)), search: "" });
  const setDraft = (fn) =>
    setPicker((p) => ({ ...p, draft: fn(new Set(p.draft)) }));
  const draftToggle = (ids, on) =>
    setDraft((d) => {
      ids.forEach((id) => (on ? d.add(id) : d.delete(id)));
      return d;
    });
  const usePicked = () => {
    const keep = rows.filter((r) => picker.draft.has(r.templateId));
    const added = list
      .filter(
        (t) =>
          picker.draft.has(t.id) && !keep.some((r) => r.templateId === t.id),
      )
      .map(newRow);
    setRows([...keep, ...added]);
    setPicker(null);
  };

  // ---- collapse
  const toggleCollapse = (id) =>
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const collapseAll = (on) =>
    setCollapsed(on ? new Set(rows.map((r) => r.templateId)) : new Set());
  const applyToAll = () => {
    setRows((l) =>
      l.map((r) => ({
        ...r,
        ...Object.fromEntries(PLAN_KEYS.map((k) => [k, defaults[k]])),
      })),
    );
    setRowErrors({});
    toast.success("Defaults applied to every picked task");
  };
  const setDefault = (k, v) => setDefaults((d) => ({ ...d, [k]: v }));

  // the answer to "template or plan?": the template opens its task picker
  const pickMode = (m) => {
    setChoosing(false);
    setMode(m);
    if (m === "template") setPicker({ draft: new Set(rows.map((r) => r.templateId)), search: "" });
  };

  const create = useMutation({
    mutationFn: (body) => tasksApi.fromTemplate(body),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(
        `${r.created} task${r.created === 1 ? "" : "s"} added to ${project?.title}`,
      );
      navigate("/tasks");
    },
    onError: (err) => {
      // "items.2.plannedEnd" → mark that row
      const field = err?.response?.data?.details?.[0]?.field ?? "";
      const m = /^items\.(\d+)\./.exec(field);
      if (m && rows[Number(m[1])])
        setRowErrors({ [rows[Number(m[1])].templateId]: errorMessage(err) });
      toast.error(errorMessage(err));
    },
  });

  const submit = () => {
    if (!projectId) return setProjectError("Select the project");
    const errs = Object.fromEntries(
      rows.map((r) => [r.templateId, rowError(r)]).filter(([, e]) => e),
    );
    setRowErrors(errs);
    if (Object.keys(errs).length) {
      setCollapsed((c) => new Set([...c].filter((id) => !errs[id])));
      toast.error("Check the highlighted tasks");
      return;
    }
    create.mutate({
      projectId,
      items: rows.map((r) => ({
        templateId: r.templateId,
        ownerId: r.ownerId,
        assignedTo: r.assignedTo,
        priority: r.priority,
        isContinuous: r.isContinuous,
        plannedStart: r.isContinuous
          ? null
          : zonedToIso(r.startDate, r.startTime),
        plannedEnd: r.isContinuous ? null : zonedToIso(r.endDate, r.endTime),
        estimatedMinutes:
          Number(r.estH || 0) * 60 + Number(r.estM || 0) || null,
      })),
    });
  };

  if (options.isLoading || projects.isLoading) return <FullPageLoader />;
  if (projects.isError)
    return <ErrorAlert>{errorMessage(projects.error)}</ErrorAlert>;

  const projectOptions = (projects.data ?? []).map((p) => ({
    value: p.id,
    label: `${p.title} (${p.code})`,
  }));
  const picked = rows
    .map((r) => ({ r, t: list.find((x) => x.id === r.templateId) }))
    .filter((x) => x.t);
  const allCollapsed = picked.length > 0 && picked.every(({ r }) => collapsed.has(r.templateId));
  // assignee options for a task: people with the skill first, then everyone else
  const assigneeOptions = (t) => {
    if (!canAssign) return userOptions.filter((o) => o.value === user.id);
    const matched = t.matches.map((m) => ({
      value: m.userId,
      label: m.name,
    }));
    // only people on the project (owner + members), those with the skill first
    return [
      ...matched,
      ...userOptions.filter(
        (o) =>
          (project?.peopleIds ?? []).includes(o.value) &&
          !t.matches.some((m) => m.userId === o.value),
      ),
    ];
  };
  return (
    <>
      <Topbar
        title="Add tasks from template"
        breadcrumb={["Task", "Task"]}
        back="/tasks"
      />
      <div className="form-layout">
        <div className="form-main">
          {/* 1 – project */}
          <section className="card card-lg form-card">
            <div className="fc-head">
              <span className="fc-num">1</span>
              <div>
                <div className="form-section-title">Project</div>
                <div className="form-section-sub">
                  Ongoing projects you own (not completed). Its project type
                  decides which template tasks you can pick.
                </div>
              </div>
            </div>
            <div className="form-grid">
              <Field label="Project" required span={2} error={projectError}>
                <Dropdown
                  search
                  placeholder={
                    projectOptions.length
                      ? "Select project"
                      : "You own no ongoing projects"
                  }
                  disabled={!projectOptions.length}
                  options={projectOptions}
                  value={projectId}
                  onChange={(v) => {
                    setProjectId(v);
                    // the project owner owns the tasks by default
                    const pr = (projects.data ?? []).find((p) => p.id === v);
                    if (pr?.ownerId && canAssign) setDefaults((d) => ({ ...d, ownerId: pr.ownerId }));
                    setRows([]);
                    setRowErrors({});
                    setCollapsed(new Set());
                    setProjectError(null);
                    setMode(null);
                    setChoosing(true); // ask: from the template or from the project plan
                  }}
                />
              </Field>
              {project && (
                <Field label="Project type" span={2}>
                  <div className="tpl-proj-meta">
                    <span className="badge badge-info">
                      {project.projectTypeName ?? "No type"}
                    </span>
                    {project.customerName && (
                      <span className="muted small">
                        {project.customerName}
                      </span>
                    )}
                    <span className="muted small">
                      {project.templateCount} template task
                      {project.templateCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </Field>
              )}
            </div>
          </section>

          {/* 2 – how to add: not chosen yet */}
          {projectId && mode === null && (
            <section className="card card-lg form-card">
              <div className="fc-head">
                <span className="fc-num">2</span>
                <div>
                  <div className="form-section-title">How do you want to add the tasks?</div>
                  <div className="form-section-sub">Use the project type&apos;s template, or create one task for each task group of the project plan.</div>
                </div>
              </div>
              <HowToAdd project={project} onPick={pickMode} />
            </section>
          )}
          {projectId && mode === "plan" && project && (
            <TaskPlanSection key={projectId} project={project} canAssign={canAssign} users={users} onChangeMode={() => setChoosing(true)} />
          )}

          {/* 2 – picked tasks: defaults + one card per task */}
          {projectId && mode === "template" && (
            <section className="card card-lg form-card">
              <div className="fc-head">
                <span className="fc-num">2</span>
                <div style={{ flex: 1 }}>
                  <div className="form-section-title">
                    Tasks &amp; plan{" "}
                    <span className="badge">{picked.length}</span>
                  </div>
                  <div className="form-section-sub">
                    Each task has its own people and plan. Defaults fill new
                    picks – use Apply to all to copy them to every task.
                  </div>
                </div>
                {list.length > 0 && (
                  <div className="tpl-head-actions">
                    {picked.length > 1 && (
                      // one toggle: collapse while any card is open, expand once all are collapsed
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => collapseAll(!allCollapsed)}
                      >
                        {allCollapsed ? <ChevronsUpDown /> : <ChevronsDownUp />}
                        {allCollapsed ? "Expand all" : "Collapse all"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={openPicker}
                    >
                      <ListPlus />
                      Pick tasks
                    </button>
                  </div>
                )}
              </div>

              {templates.isLoading ? (
                <Spinner />
              ) : !list.length ? (
                <EmptyState icon={LayoutTemplate} title="No template tasks">
                  The project type &quot;{project?.projectTypeName}&quot; has no
                  task template yet (Business Division → Task Templates).
                </EmptyState>
              ) : (
                <>
                  <div className="tpl-defaults">
                    <div className="tpl-defaults-head">
                      <b>Defaults</b>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={!picked.length}
                        onClick={applyToAll}
                      >
                        <CopyCheck />
                        Apply to all
                      </button>
                    </div>
                    <div className="tpl-defaults-grid">
                      <Field label="Owner">
                        <Dropdown
                          search
                          disabled={!canAssign}
                          options={userOptions}
                          value={defaults.ownerId}
                          onChange={(v) => setDefault("ownerId", v)}
                        />
                      </Field>
                      <Field label="Priority">
                        <Dropdown
                          options={TASK_PRIORITY_OPTIONS}
                          value={defaults.priority}
                          onChange={(v) => setDefault("priority", v)}
                        />
                      </Field>
                      <Field label="Continuous" className="tpl-span2">
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            minHeight: 40,
                          }}
                        >
                          <Switch
                            checked={defaults.isContinuous}
                            onChange={(v) => setDefault("isContinuous", v)}
                            label={
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <InfinityIcon
                                  style={{ width: 16, height: 16 }}
                                />{" "}
                                Ongoing{" "}
                                <span className="muted small">
                                  (no earliest start / end before)
                                </span>
                              </span>
                            }
                          />
                        </div>
                      </Field>
                      <Field label="Earliest start" className="tpl-span2">
                        <div className="tpl-dt">
                          <DatePicker
                            value={defaults.startDate}
                            clearable={false}
                            disabled={defaults.isContinuous}
                            onChange={(v) => setDefault("startDate", v)}
                          />
                          <TimePicker
                            value={defaults.startTime}
                            disabled={defaults.isContinuous}
                            onChange={(v) => setDefault("startTime", v)}
                          />
                        </div>
                      </Field>
                      <Field label="End before" className="tpl-span2">
                        <div className="tpl-dt">
                          <DatePicker
                            value={defaults.endDate}
                            clearable={false}
                            disabled={defaults.isContinuous}
                            min={defaults.startDate || undefined}
                            placeholder="Date"
                            onChange={(v) => setDefault("endDate", v)}
                          />
                          <TimePicker
                            value={defaults.endTime}
                            disabled={defaults.isContinuous}
                            onChange={(v) => setDefault("endTime", v)}
                          />
                        </div>
                      </Field>
                    </div>
                  </div>

                  {!picked.length ? (
                    <div className="tpl-empty-pick">
                      <ListChecks />
                      <span>No tasks picked yet.</span>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={openPicker}
                      >
                        <ListPlus />
                        Pick tasks
                      </button>
                    </div>
                  ) : (
                    <div className="tpl-tasks">
                      {picked.map(({ r, t }, i) => {
                        const err = rowErrors[r.templateId];
                        const isCollapsed = collapsed.has(r.templateId);
                        // one-line summary shown while collapsed
                        const summary = [
                          users.find((u) => u.id === r.assignedTo)?.name ?? "—",
                          TASK_PRIORITY_OPTIONS.find(
                            (o) => o.value === r.priority,
                          )?.label,
                          r.isContinuous
                            ? "Continuous"
                            : `${r.startDate ? formatDate(r.startDate) : "—"} → ${r.endDate ? formatDate(r.endDate) : "—"}`,
                        ];
                        return (
                          <div
                            key={r.templateId}
                            className={`tpl-task${err ? " is-error" : ""}${isCollapsed ? " is-collapsed" : ""}`}
                          >
                            <div className="tpl-task-head">
                              <button
                                type="button"
                                className="icon-btn tpl-collapse"
                                title={isCollapsed ? "Expand" : "Collapse"}
                                aria-expanded={!isCollapsed}
                                onClick={() => toggleCollapse(r.templateId)}
                              >
                                <ChevronDown />
                              </button>
                              <span className="tpl-task-no">{i + 1}</span>
                              <div
                                className="tpl-task-name"
                                onClick={() => toggleCollapse(r.templateId)}
                              >
                                <b>{t.title}</b>
                                {isCollapsed ? (
                                  <span className="tpl-task-summary">
                                    {summary.map((x, k) => (
                                      <span key={k}>{x}</span>
                                    ))}
                                  </span>
                                ) : (
                                  <span className="muted small">
                                    {t.taskGroupName} · {t.taskTypeName}
                                    {t.skills.length
                                      ? ` · needs ${t.skills.join(", ")}`
                                      : ""}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                className="icon-btn is-danger"
                                title="Remove task"
                                onClick={() => removeRow(t)}
                              >
                                <Trash2 />
                              </button>
                            </div>
                            {err && <div className="tpl-row-err">{err}</div>}
                            {!isCollapsed && (
                              <>
                                <div className="tpl-task-grid">
                                  <Field label="Owner">
                                    <Dropdown
                                      search
                                      disabled={!canAssign}
                                      options={userOptions}
                                      value={r.ownerId}
                                      onChange={(v) =>
                                        setRow(r.templateId, { ownerId: v })
                                      }
                                    />
                                  </Field>
                                  <Field
                                    label="Assigned to"
                                    // only a warning when nobody on the project has the skill
                                    help={
                                      t.skills.length && !t.matches.length
                                        ? "no one on the project has this skill"
                                        : undefined
                                    }
                                  >
                                    <Dropdown
                                      search
                                      disabled={!canAssign}
                                      options={assigneeOptions(t)}
                                      value={r.assignedTo}
                                      onChange={(v) =>
                                        setRow(r.templateId, { assignedTo: v })
                                      }
                                    />
                                  </Field>
                                  <Field label="Priority">
                                    <Dropdown
                                      options={TASK_PRIORITY_OPTIONS}
                                      value={r.priority}
                                      onChange={(v) =>
                                        setRow(r.templateId, { priority: v })
                                      }
                                    />
                                  </Field>
                                  <Field label="Estimate">
                                    <div className="tpl-est">
                                      <div className="input-group">
                                        <input
                                          className="input has-trail"
                                          type="number"
                                          min="0"
                                          inputMode="numeric"
                                          placeholder="0"
                                          value={r.estH}
                                          onKeyDown={blockNonNumericKeys}
                                          onChange={(e) =>
                                            setRow(r.templateId, {
                                              estH: e.target.value,
                                            })
                                          }
                                        />
                                        <span className="trail">h</span>
                                      </div>
                                      <div className="input-group">
                                        <input
                                          className="input has-trail"
                                          type="number"
                                          min="0"
                                          inputMode="numeric"
                                          placeholder="0"
                                          value={r.estM}
                                          onKeyDown={blockNonNumericKeys}
                                          onChange={(e) =>
                                            setRow(r.templateId, {
                                              estM: e.target.value,
                                            })
                                          }
                                          // 80 min → +1 h 20 min
                                          onBlur={() => {
                                            const m = Number(r.estM || 0);
                                            if (m >= 60)
                                              setRow(r.templateId, {
                                                estH: String(
                                                  Number(r.estH || 0) +
                                                    Math.floor(m / 60),
                                                ),
                                                estM: String(m % 60),
                                              });
                                          }}
                                        />
                                        <span className="trail">min</span>
                                      </div>
                                    </div>
                                  </Field>
                                  <Field
                                    label="Earliest start"
                                    className="tpl-span2"
                                  >
                                    <div className="tpl-dt">
                                      <DatePicker
                                        value={r.startDate}
                                        clearable={false}
                                        disabled={r.isContinuous}
                                        placeholder="Date"
                                        onChange={(v) =>
                                          setRow(r.templateId, { startDate: v })
                                        }
                                      />
                                      <TimePicker
                                        value={r.startTime}
                                        disabled={r.isContinuous}
                                        onChange={(v) =>
                                          setRow(r.templateId, { startTime: v })
                                        }
                                      />
                                    </div>
                                  </Field>
                                  <Field
                                    label="End before"
                                    className="tpl-span2"
                                  >
                                    <div className="tpl-dt">
                                      <DatePicker
                                        value={r.endDate}
                                        clearable={false}
                                        disabled={r.isContinuous}
                                        min={r.startDate || undefined}
                                        placeholder="Date"
                                        onChange={(v) =>
                                          setRow(r.templateId, { endDate: v })
                                        }
                                      />
                                      <TimePicker
                                        value={r.endTime}
                                        disabled={r.isContinuous}
                                        onChange={(v) =>
                                          setRow(r.templateId, { endTime: v })
                                        }
                                      />
                                    </div>
                                  </Field>
                                </div>
                                <div className="tpl-task-foot">
                                  <Switch
                                    checked={r.isContinuous}
                                    onChange={(v) =>
                                      setRow(r.templateId, { isContinuous: v })
                                    }
                                    label={
                                      <span
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 6,
                                        }}
                                      >
                                        <InfinityIcon
                                          style={{ width: 15, height: 15 }}
                                        />{" "}
                                        Continuous{" "}
                                        <span className="muted small">
                                          (no dates)
                                        </span>
                                      </span>
                                    }
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {mode === "template" && (
          <div className="form-bar">
            <span className="note">
              <Cloud />
              Each task is created as To do
            </span>
            <div className="actions">
              <Link className="btn btn-ghost" to="/tasks">
                Cancel
              </Link>
              <button
                type="button"
                className="btn btn-primary"
                disabled={create.isPending || !picked.length}
                onClick={submit}
              >
                <Check />
                {create.isPending
                  ? "Adding…"
                  : picked.length
                    ? `Add ${picked.length} task${picked.length === 1 ? "" : "s"}`
                    : "Add tasks"}
              </button>
            </div>
          </div>
          )}
        </div>
      </div>
      <Modal open={choosing} title="How do you want to add the tasks?" onClose={() => setChoosing(false)}>
        <HowToAdd project={project} onPick={pickMode} />
      </Modal>
      <Modal
        open={!!picker}
        size="lg"
        title={`Pick template tasks · ${project?.projectTypeName ?? ""}`}
        onClose={() => setPicker(null)}
        footer={
          picker && (
            <>
              <span
                className="muted small"
                style={{ marginRight: "auto", alignSelf: "center" }}
              >
                {picker.draft.size} of {list.length} selected
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPicker(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={usePicked}
              >
                <Check />
                Use {picker.draft.size} task{picker.draft.size === 1 ? "" : "s"}
              </button>
            </>
          )
        }
      >
        {picker && templates.isLoading && <Spinner />}
        {picker && !templates.isLoading && !list.length && (
          <p className="muted" style={{ margin: 0 }}>
            The project type &quot;{project?.projectTypeName}&quot; has no task template yet (Business Division → Task Templates).
          </p>
        )}
        {picker && list.length > 0 && (
          <>
            <div className="input-group search" style={{ marginBottom: 12 }}>
              <Search />
              <input
                className="input"
                placeholder="Search tasks, types or skills…"
                value={picker.search}
                onChange={(e) =>
                  setPicker((p) => ({ ...p, search: e.target.value }))
                }
              />
            </div>
            <div className="tpl-pick tpl-pick-scroll">
              {byGroup.map(([group, all]) => {
                const tasks = all.filter((t) =>
                  matchesSearch(t, picker.search),
                );
                if (!tasks.length) return null;
                const ids = tasks.map((t) => t.id);
                const allOn = ids.every((id) => picker.draft.has(id));
                const some = !allOn && ids.some((id) => picker.draft.has(id));
                return (
                  <div key={group} className="tpl-pick-group">
                    <div className="tpl-pick-head">
                      <Checkbox
                        checked={allOn}
                        indeterminate={some}
                        onChange={(v) => draftToggle(ids, v)}
                        title="Pick all in this group"
                      />
                      <b>{group}</b>
                      <span className="muted small">
                        {all.filter((t) => picker.draft.has(t.id)).length}/
                        {all.length} picked
                      </span>
                    </div>
                    {tasks.map((t) => (
                      <label
                        key={t.id}
                        className={`tpl-pick-row${picker.draft.has(t.id) ? " is-picked" : ""}`}
                      >
                        <Checkbox
                          checked={picker.draft.has(t.id)}
                          onChange={(v) => draftToggle([t.id], v)}
                        />
                        <div className="tpl-pick-main">
                          <div className="tpl-pick-title">
                            {t.title}
                            {t.existing > 0 && (
                              <span
                                className="badge badge-warning"
                                title="The project already has a task with this name"
                              >
                                Already a task
                                {t.existing > 1 ? ` ×${t.existing}` : ""}
                              </span>
                            )}
                          </div>
                          <div className="muted small">
                            {t.taskTypeName}
                            {t.skills.length
                              ? ` · needs ${t.skills.join(", ")}`
                              : ""}
                          </div>
                        </div>
                        {t.matches.length > 0 && (
                          <span
                            className="tpl-suggest"
                            title={t.matches
                              .map((m) => `${m.name} (${m.skills.join(", ")})`)
                              .join("\n")}
                          >
                            <Sparkles /> {t.matches[0].name}
                            {t.matches.length > 1
                              ? ` +${t.matches.length - 1}`
                              : ""}
                          </span>
                        )}
                        <span className="small nowrap">
                          {formatMinutes(t.estimatedMinutes)}
                        </span>
                      </label>
                    ))}
                  </div>
                );
              })}
              {!byGroup.some(([, all]) =>
                all.some((t) => matchesSearch(t, picker.search)),
              ) && (
                <p className="muted small">
                  No template tasks match “{picker.search}”.
                </p>
              )}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
