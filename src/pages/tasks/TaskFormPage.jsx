import { useEffect, useMemo, useRef, useCallback } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Cloud,
  Infinity as InfinityIcon,
  Plus,
  Trash2,
} from "lucide-react";
import { mastersApi, tasksApi } from "@/api/endpoints";
import { errorMessage } from "@/api/client";
import { useAuth, usePermissions } from "@/auth/auth-context";
import { Topbar } from "@/components/layout/Topbar";
import { DatePicker } from "@/components/ui/DatePicker";
import { TimePicker } from "@/components/ui/TimePicker";
import { ErrorAlert } from "@/components/ui/Display";
import { Dropdown } from "@/components/ui/Dropdown";
import { Checkbox, ChoiceGroup, Field, Switch } from "@/components/ui/Field";
import { FullPageLoader } from "@/components/ui/Loader";
import { useConfirm } from "@/components/ui/confirm-context";
import { useToast } from "@/components/ui/toast-context";
import { useApiFormError } from "@/hooks/useApiForm";
import {
  SCREENS,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
} from "@/lib/constants";
import { blockNonNumericKeys } from "@/lib/percent";
import { todayIso, zonedParts, zonedToIso } from "@/lib/timezone";

// a new task ends 10 days after its earliest start by default (editable)
const DEFAULT_SPAN_DAYS = 10;
const plusDays = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
import NotFoundPage from "@/pages/errors/NotFoundPage";

// earliest start / end before are typed and shown in the user's time zone (lib/timezone)
/** ISO timestamp → { date: 'YYYY-MM-DD', time: 'HH:MM' } */
const splitDateTime = (v) => (v ? zonedParts(v) : { date: "", time: "" });
/** date + time → ISO timestamp */
const joinDateTime = (date, time) => zonedToIso(date, time);

const whole = (max, msg) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) <= max), msg);

const schema = z
  .object({
    name: z.string().trim().min(1, "Enter the task title").max(300),
    description: z.string().max(5000),
    categoryId: z.number({ error: "Select the category" }),
    projectId: z.number().nullable(),
    taskGroupId: z.number().nullable(),
    taskTypeId: z.number().nullable(),
    ownerId: z.number({ error: "Select the task owner" }),
    assignedTo: z.number({ error: "Select who does the task" }),
    estHours: whole(9999, "Whole hours"),
    estMinutes: whole(99999, "Whole minutes"), // 60+ is carried into hours on blur
    priority: z.string(),
    status: z.string(),
    isContinuous: z.boolean(),
    startDate: z.string(),
    startTime: z.string(),
    endDate: z.string(),
    endTime: z.string(),
    completedOn: z.string(),
    subtasks: z.array(
      z.object({
        id: z.number().optional(),
        title: z.string().trim().min(1, "Enter the subtask").max(300),
        dueDate: z.string(),
        isDone: z.boolean(),
      }),
    ),
    needsProject: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const add = (path, message) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (v.needsProject && !v.projectId) add("projectId", "Select the project");
    if (!v.isContinuous) {
      if (!v.startDate) add("startDate", "Select the earliest start");
      if (!v.endDate) add("endDate", "Select the end before date");
      if (
        v.startDate &&
        v.endDate &&
        joinDateTime(v.endDate, v.endTime) <=
          joinDateTime(v.startDate, v.startTime)
      )
        add("endDate", "Must be after the earliest start");
      // a subtask is due on or before the day the task ends
      if (v.endDate)
        v.subtasks.forEach((s, i) => {
          if (s.dueDate && s.dueDate > v.endDate)
            ctx.addIssue({ code: "custom", path: ["subtasks", i, "dueDate"], message: "After the task's end date" });
        });
    }
  });

export default function TaskFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const perms = usePermissions(SCREENS.TASKS);
  const navigate = useNavigate();
  // opened from the task details (which may itself come from a project): return there, keeping its own "back"
  const { from, viewFrom } = useLocation().state ?? {};
  const backTo = from ?? "/tasks";
  const backState = viewFrom ? { from: viewFrom } : undefined;
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const options = useQuery({
    queryKey: ["tasks", "options"],
    queryFn: tasksApi.options,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: "always", // project members may have changed – the cached list shows meanwhile
  });
  const task = useQuery({
    queryKey: ["tasks", "item", id],
    queryFn: () => tasksApi.get(id),
    enabled: isEdit,
    retry: false,
  });

  const EMPTY = useMemo(
    () => ({
      name: "",
      description: "",
      categoryId: undefined,
      projectId: null,
      taskGroupId: null,
      taskTypeId: null,
      ownerId: user.id,
      assignedTo: user.id,
      estHours: "",
      estMinutes: "",
      priority: "medium",
      status: "to_do",
      isContinuous: false,
      startDate: todayIso(),
      startTime: "09:00",
      endDate: plusDays(todayIso(), DEFAULT_SPAN_DAYS),
      endTime: "18:00",
      completedOn: "",
      subtasks: [],
      needsProject: false,
    }),
    [user.id],
  );

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { formError, handleApiError } = useApiFormError(setError);
  const subtasks = useFieldArray({ control, name: "subtasks", keyName: "key" });
  const addAnother = useRef(false);
  const [categoryId, isContinuous, status, taskGroupId, projectId, needsProject, endDate] = useWatch({
    control,
    name: ["categoryId", "isContinuous", "status", "taskGroupId", "projectId", "needsProject", "endDate"],
  });
  // task group → its task types
  const groups = useQuery({
    queryKey: ["masters", "task-groups"],
    queryFn: () => mastersApi.list("task-groups"),
    staleTime: 5 * 60 * 1000,
  });
  const types = useQuery({
    queryKey: ["masters", "task-types"],
    queryFn: () => mastersApi.list("task-types"),
    staleTime: 5 * 60 * 1000,
  });

  const categories = useMemo(
    () => options.data?.categories ?? [],
    [options.data],
  );
  const category = categories.find((c) => c.id === categoryId);
  const canAssign = options.data?.canAssignOthers ?? false;
  // Personal / Activity: the owner's own task (you, on a new one), done by them; ongoing or with dates, as chosen
  const ownTask = Boolean(category && !category.isProject);
  const makeOwn = useCallback(() => {
    const self = isEdit ? (task.data?.ownerId ?? user.id) : user.id;
    setValue("ownerId", self);
    setValue("assignedTo", self);
  }, [isEdit, task.data?.ownerId, user.id, setValue]);
  // dates of a new task: Personal / Activity default to a single day (end = start), project tasks to a span
  const span = ownTask ? 0 : DEFAULT_SPAN_DAYS;
  const setDefaultEnd = useCallback((own) => setValue("endDate", plusDays(getValues("startDate"), own ? 0 : DEFAULT_SPAN_DAYS)), [getValues, setValue]);

  // default category: the first one; Project when it is first
  useEffect(() => {
    if (!isEdit && categories.length && getValues("categoryId") === undefined) {
      setValue("categoryId", categories[0].id);
      setValue("needsProject", categories[0].isProject);
      if (!categories[0].isProject) {
        makeOwn();
        setDefaultEnd(true);
      }
    }
  }, [categories, isEdit, getValues, setValue, makeOwn, setDefaultEnd]);

  useEffect(() => {
    const t = task.data;
    if (!t) return;
    const s = splitDateTime(t.plannedStart);
    const e = splitDateTime(t.plannedEnd);
    reset({
      name: t.name,
      description: t.description ?? "",
      categoryId: t.categoryId ?? undefined,
      projectId: t.projectId,
      taskGroupId: t.taskGroupId ?? null,
      taskTypeId: t.taskTypeId ?? null,
      ownerId: t.ownerId ?? user.id,
      assignedTo: t.assignedTo ?? undefined,
      estHours: t.estimatedMinutes
        ? String(Math.floor(t.estimatedMinutes / 60))
        : "",
      estMinutes: t.estimatedMinutes ? String(t.estimatedMinutes % 60) : "",
      priority: t.priority ?? "medium",
      status: t.status,
      isContinuous: t.isContinuous,
      startDate: s.date,
      startTime: s.time || "09:00",
      endDate: e.date,
      endTime: e.time || "18:00",
      completedOn: t.completedOn ?? "",
      subtasks: t.subtasks.map((x) => ({
        id: x.id,
        title: x.title,
        dueDate: x.dueDate ?? "",
        isDone: x.isDone,
      })),
      needsProject: t.isProjectCategory,
    });
  }, [task.data, reset, user.id]);

  const save = useMutation({
    mutationFn: (body) =>
      isEdit ? tasksApi.update(id, body) : tasksApi.create(body),
    onSuccess: (saved, body) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(isEdit ? "Task updated" : `Task "${saved.name}" created`);
      if (addAnother.current) {
        // next task: same category / project / people, the rest cleared
        reset({
          ...EMPTY,
          categoryId: body.categoryId,
          needsProject: getValues("needsProject"),
          projectId: body.projectId,
          ownerId: body.ownerId,
          assignedTo: body.assignedTo,
        });
        return;
      }
      navigate(backTo, { state: backState });
    },
    onError: (err) => handleApiError(err),
  });

  if (options.isLoading || (isEdit && task.isLoading))
    return <FullPageLoader />;
  if (isEdit && task.isError) {
    return task.error?.response?.status === 404 ? (
      <NotFoundPage what="Task" />
    ) : (
      <ErrorAlert>{errorMessage(task.error)}</ErrorAlert>
    );
  }

  const err = (n) => errors[n]?.message;
  const opt = (rows, label = (r) => r.name) =>
    (rows ?? []).map((r) => ({ value: r.id, label: label(r) }));
  const userOptions = (() => {
    const list = opt(options.data?.users);
    // keep people already on the task even when they are not in the list (e.g. assigned by a manager)
    for (const [uid, name] of [
      [task.data?.ownerId, task.data?.ownerName],
      [task.data?.assignedTo, task.data?.assignedToName],
    ]) {
      if (uid && !list.some((o) => o.value === uid))
        list.push({ value: uid, label: name });
    }
    return list;
  })();
  // a project task: assigned to someone on the project (its owner or a member, project Users tab)
  const selectedProject = needsProject ? (options.data?.projects ?? []).find((p) => p.id === projectId) : null;
  const assigneeOptions = selectedProject
    ? userOptions.filter((o) => selectedProject.peopleIds.includes(o.value) || o.value === task.data?.assignedTo)
    : userOptions;
  const projectOptions = opt(options.data?.projects, (p) =>
    p.code ? `${p.title ?? p.name} (${p.code})` : p.name,
  );
  if (
    task.data?.projectId &&
    !projectOptions.some((o) => o.value === task.data.projectId)
  )
    projectOptions.push({
      value: task.data.projectId,
      label: task.data.projectTitle,
    });

  // minutes over 59 move into hours: 2 h 80 min -> 3 h 20 min
  const normalizeEstimate = () => {
    const h = Number(getValues("estHours") || 0);
    const m = Number(getValues("estMinutes") || 0);
    if (!Number.isInteger(h) || !Number.isInteger(m) || m < 60) return;
    setValue("estHours", String(h + Math.floor(m / 60)), {
      shouldValidate: true,
    });
    setValue("estMinutes", String(m % 60), { shouldValidate: true });
  };
  const minutesReg = register("estMinutes");
  const estMinutesField = {
    ...minutesReg,
    onBlur: (e) => {
      minutesReg.onBlur(e);
      normalizeEstimate();
    },
  };

  const onSubmit = (v) => {
    const minutes = Number(v.estHours || 0) * 60 + Number(v.estMinutes || 0);
    return save
      .mutateAsync({
        name: v.name.trim(),
        description: v.description.trim() || null,
        categoryId: v.categoryId,
        projectId: v.needsProject ? v.projectId : null,
        taskGroupId: v.taskGroupId ?? null,
        taskTypeId: v.taskTypeId ?? null,
        ownerId: v.ownerId,
        assignedTo: v.assignedTo,
        estimatedMinutes: minutes || null,
        priority: v.priority,
        status: v.status,
        isContinuous: v.isContinuous,
        plannedStart: v.isContinuous
          ? null
          : joinDateTime(v.startDate, v.startTime),
        plannedEnd: v.isContinuous ? null : joinDateTime(v.endDate, v.endTime),
        completedOn:
          v.status === "completed" ? v.completedOn || todayIso() : null,
        subtasks: v.subtasks.map((s) => ({
          ...(s.id ? { id: s.id } : {}),
          title: s.title.trim(),
          dueDate: s.dueDate || null,
          isDone: s.isDone,
        })),
      })
      .catch(() => {});
  };

  const removeSubtask = async (i) => {
    const title = getValues(`subtasks.${i}.title`)?.trim();
    if (
      title &&
      !(await confirm({
        title: "Remove subtask?",
        message: `"${title}" is removed when you save the task.`,
        confirmLabel: "Remove",
      }))
    )
      return;
    subtasks.remove(i);
  };

  const subErr = (i, k) => errors.subtasks?.[i]?.[k]?.message;

  // only the owner / creator (and All-scope roles) edit the whole task; the assignee and
  // subtask people work from the details page
  if (isEdit && task.data && !(perms.edit && task.data.canManage))
    return <Navigate to={`/tasks/${id}`} replace />;

  return (
    <>
      <Topbar
        title={isEdit ? "Edit task" : "New task"}
        breadcrumb={["Task", "Task"]}
        back={backTo}
        backState={backState}
      />
      <form
        className="form-layout"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <div className="form-main">
          <ErrorAlert>{formError}</ErrorAlert>

          <section className="card card-lg form-card">
            <div className="fc-head">
              <span className="fc-num">1</span>
              <div>
                <div className="form-section-title">Task</div>
                <div className="form-section-sub">
                  What needs to be done. Project tasks are added to one of your
                  projects.
                </div>
              </div>
            </div>
            <div className="form-grid">
              {/* row 1: title, category, project (category stays put; the project slot is empty for other categories) – row 2: description */}
              <Field label="Title" required span={2} error={err("name")}>
                <input
                  className="input"
                  maxLength={300}
                  placeholder="e.g. Prepare the monthly report"
                  {...register("name")}
                />
              </Field>
              <Field label="Category" required error={err("categoryId")}>
                <Controller
                  name="categoryId"
                  control={control}
                  render={({ field }) => (
                    <Dropdown
                      placeholder="Select category"
                      options={opt(categories)}
                      value={field.value}
                      onChange={(v) => {
                        field.onChange(v);
                        const c = categories.find((x) => x.id === v);
                        setValue("needsProject", !!c?.isProject);
                        // a group the new category does not use no longer fits
                        if (c?.taskGroupIds?.length && !c.taskGroupIds.includes(getValues("taskGroupId"))) {
                          setValue("taskGroupId", null);
                          setValue("taskTypeId", null);
                        }
                        if (!c?.isProject) {
                          setValue("projectId", null);
                          makeOwn();
                        }
                        // a new task: the default end follows the category (one day for Personal / Activity)
                        if (!isEdit) setDefaultEnd(!c?.isProject);
                      }}
                    />
                  )}
                />
              </Field>
              {category?.isProject && (
                <Field label="Project" required error={err("projectId")}>
                  <Controller
                    name="projectId"
                    control={control}
                    render={({ field }) => (
                      <Dropdown
                        search
                        placeholder={
                          projectOptions.length
                            ? "Select project"
                            : "No projects"
                        }
                        disabled={!projectOptions.length}
                        options={projectOptions}
                        value={field.value}
                        onChange={(v) => {
                          field.onChange(v);
                          // the project owner owns the task by default; the assignee must be on the project
                          const pr = (options.data?.projects ?? []).find((p) => p.id === v);
                          if (pr && canAssign) {
                            if (pr.ownerId) setValue("ownerId", pr.ownerId);
                            if (!pr.peopleIds.includes(getValues("assignedTo"))) setValue("assignedTo", pr.ownerId ?? null);
                          }
                        }}
                      />
                    )}
                  />
                </Field>
              )}
              {/* row 2: description on the left, task group / type on the right */}
              <Field label="Description" span={2} error={err("description")}>
                <textarea
                  className="textarea"
                  rows={3}
                  style={{ minHeight: 90 }}
                  maxLength={5000}
                  placeholder="Details, links, notes…"
                  {...register("description")}
                />
              </Field>
              <Field label="Task group" error={err("taskGroupId")}>
                <Controller
                  name="taskGroupId"
                  control={control}
                  render={({ field }) => (
                    <Dropdown
                      search
                      clearable
                      placeholder="Select task group"
                      options={(groups.data ?? [])
                        .filter((g) => !category?.taskGroupIds?.length || category.taskGroupIds.includes(g.id))
                        .map((g) => ({
                          value: g.id,
                          label: g.name,
                        }))}
                      value={field.value}
                      onChange={(v) => {
                        field.onChange(v ?? null);
                        const type = (types.data ?? []).find(
                          (x) => x.id === getValues("taskTypeId"),
                        );
                        if (type && type.groupId !== v)
                          setValue("taskTypeId", null);
                      }}
                    />
                  )}
                />
              </Field>
              <Field label="Task type" error={err("taskTypeId")}>
                <Controller
                  name="taskTypeId"
                  control={control}
                  render={({ field }) => {
                    const typeOptions = (types.data ?? [])
                      .filter((x) => x.groupId === taskGroupId)
                      .map((x) => ({ value: x.id, label: x.name }));
                    return (
                      <Dropdown
                        search
                        clearable
                        disabled={!taskGroupId}
                        placeholder={
                          !taskGroupId
                            ? "Select task group first"
                            : typeOptions.length
                              ? "Select task type"
                              : "No task types in this group"
                        }
                        options={typeOptions}
                        value={field.value}
                        onChange={(v) => field.onChange(v ?? null)}
                      />
                    );
                  }}
                />
              </Field>
            </div>
          </section>

          <section className="card card-lg form-card">
            <div className="fc-head">
              <span className="fc-num">2</span>
              <div>
                <div className="form-section-title">People &amp; plan</div>
                <div className="form-section-sub">
                  {canAssign
                    ? "Who owns the task, who does it, and when."
                    : isEdit && task.data && task.data.ownerId !== user.id
                      ? `${task.data.ownerName} owns this task – only they can change the people.`
                      : "Your own task – you are the owner and the assignee."}{" "}
                  A continuous task has no start or end date.
                </div>
              </div>
            </div>
            <div className="form-grid">
              <Field label="Task owner" required error={err("ownerId")}>
                <Controller
                  name="ownerId"
                  control={control}
                  render={({ field }) => (
                    <Dropdown
                      search
                      disabled={!canAssign || ownTask}
                      options={userOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select owner"
                    />
                  )}
                />
              </Field>
              <Field
                label="Assigned to"
                required
                error={err("assignedTo")}
                help={selectedProject ? "the project owner and members" : ownTask ? `${category.name} tasks are your own` : undefined}
              >
                <Controller
                  name="assignedTo"
                  control={control}
                  render={({ field }) => (
                    <Dropdown
                      search
                      disabled={!canAssign || ownTask}
                      options={assigneeOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select person"
                    />
                  )}
                />
              </Field>
              <Field
                label="Estimate time"
                error={err("estHours") ?? err("estMinutes")}
              >
                <div style={{ display: "flex", gap: 8 }}>
                  <div className="input-group" style={{ flex: 1 }}>
                    <input
                      className="input has-trail"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      placeholder="0"
                      onKeyDown={blockNonNumericKeys}
                      {...register("estHours")}
                    />
                    <span className="trail">h</span>
                  </div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <input
                      className="input has-trail"
                      type="number"
                      min="0"
                      step="5"
                      inputMode="numeric"
                      placeholder="0"
                      onKeyDown={blockNonNumericKeys}
                      {...estMinutesField}
                    />
                    <span className="trail">min</span>
                  </div>
                </div>
              </Field>
              <Field label="Priority" span={2}>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <ChoiceGroup
                      name="priority"
                      options={TASK_PRIORITY_OPTIONS}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </Field>
              {/* next to Priority */}
              <Field label="Continuous task" span={2}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    minHeight: 40,
                  }}
                >
                  <Controller
                    name="isContinuous"
                    control={control}
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onChange={field.onChange}
                        label={
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <InfinityIcon style={{ width: 16, height: 16 }} />{" "}
                            Ongoing{" "}
                            <span className="muted small">
                              (no earliest start / end before)
                            </span>
                          </span>
                        }
                      />
                    )}
                  />
                </div>
              </Field>
              {!isContinuous && (
                <>
                  <Field
                    label="Earliest start"
                    required
                    span={2}
                    error={err("startDate")}
                  >
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ flex: 3 }}>
                        <Controller
                          name="startDate"
                          control={control}
                          render={({ field }) => (
                            <DatePicker
                              value={field.value}
                              onChange={(v) => {
                                // the end date follows the start while it is still the default (or now before the start)
                                const end = getValues("endDate");
                                if (v && (!end || end === plusDays(field.value || v, span) || end < v)) {
                                  setValue("endDate", plusDays(v, span), { shouldValidate: Boolean(errors.endDate) });
                                }
                                field.onChange(v);
                              }}
                              clearable={false}
                              placeholder="Date"
                            />
                          )}
                        />
                      </div>
                      <div style={{ flex: 2 }}>
                        <Controller
                          name="startTime"
                          control={control}
                          render={({ field }) => (
                            <TimePicker
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Time"
                            />
                          )}
                        />
                      </div>
                    </div>
                  </Field>
                  <Field
                    label="End before"
                    required
                    span={2}
                    error={err("endDate")}
                  >
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ flex: 3 }}>
                        <Controller
                          name="endDate"
                          control={control}
                          render={({ field }) => (
                            <DatePicker
                              value={field.value}
                              onChange={field.onChange}
                              clearable={false}
                              min={getValues("startDate") || undefined}
                              placeholder="Date"
                            />
                          )}
                        />
                      </div>
                      <div style={{ flex: 2 }}>
                        <Controller
                          name="endTime"
                          control={control}
                          render={({ field }) => (
                            <TimePicker
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Time"
                            />
                          )}
                        />
                      </div>
                    </div>
                  </Field>
                </>
              )}
            </div>
          </section>

          {/* status and subtasks are set on the edit page; a new task starts as To do */}
          {isEdit && (
            <>
              <section className="card card-lg form-card">
                <div className="fc-head">
                  <span className="fc-num">3</span>
                  <div>
                    <div className="form-section-title">Status</div>
                    <div className="form-section-sub">
                      The completed date is set to today when the task is
                      completed – change it if needed.
                    </div>
                  </div>
                </div>
                <div className="form-grid">
                  <Field label="Status" span={2}>
                    <Controller
                      name="status"
                      control={control}
                      render={({ field }) => (
                        <ChoiceGroup
                          name="status"
                          options={TASK_STATUS_OPTIONS}
                          value={field.value}
                          onChange={(v) => {
                            field.onChange(v);
                            if (v === "completed" && !getValues("completedOn"))
                              setValue("completedOn", todayIso());
                          }}
                        />
                      )}
                    />
                  </Field>
                  {status === "completed" && (
                    <Field label="Completed date" required span={2}>
                      <div style={{ maxWidth: 240 }}>
                        <Controller
                          name="completedOn"
                          control={control}
                          render={({ field }) => (
                            <DatePicker
                              value={field.value}
                              onChange={field.onChange}
                              clearable={false}
                              max={todayIso()}
                            />
                          )}
                        />
                      </div>
                    </Field>
                  )}
                </div>
              </section>

              <section className="card card-lg form-card">
                <div className="fc-head">
                  <span className="fc-num">4</span>
                  <div style={{ flex: 1 }}>
                    <div className="form-section-title">Subtasks</div>
                    <div className="form-section-sub">
                      Break the task into smaller steps, each with its own
                      person and due date.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      subtasks.append({
                        title: "",
                        dueDate: "",
                        isDone: false,
                      })
                    }
                  >
                    <Plus />
                    Add subtask
                  </button>
                </div>
                {subtasks.fields.length === 0 ? (
                  <div className="muted small" style={{ padding: "4px 0" }}>
                    No subtasks.
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th className="center" style={{ width: 56 }}>
                            Done
                          </th>
                          <th>Title</th>
                          <th style={{ width: 190 }}>Due date</th>
                          <th style={{ width: 48 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {subtasks.fields.map((f, i) => (
                          <tr key={f.key}>
                            <td className="center">
                              <Controller
                                name={`subtasks.${i}.isDone`}
                                control={control}
                                render={({ field }) => (
                                  <Checkbox
                                    checked={field.value}
                                    onChange={field.onChange}
                                    title="Done"
                                  />
                                )}
                              />
                            </td>
                            <td>
                              <div
                                className={`field${subErr(i, "title") ? " has-error" : ""}`}
                                style={{ margin: 0 }}
                              >
                                <input
                                  className="input"
                                  maxLength={300}
                                  placeholder="Subtask"
                                  autoFocus={!f.id && !f.title}
                                  {...register(`subtasks.${i}.title`)}
                                />
                                {subErr(i, "title") && (
                                  <span className="help">
                                    {subErr(i, "title")}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <Controller
                                name={`subtasks.${i}.dueDate`}
                                control={control}
                                render={({ field }) => (
                                  <DatePicker
                                    value={field.value}
                                    onChange={field.onChange}
                                    min={todayIso()} // no past days (user's today)
                                    max={!isContinuous && endDate ? endDate : undefined} // not after the task's end date
                                    placeholder="Due date"
                                  />
                                )}
                              />
                              {subErr(i, "dueDate") && <span className="help" style={{ color: "var(--danger, #c0392b)" }}>{subErr(i, "dueDate")}</span>}
                            </td>
                            <td className="center">
                              <button
                                type="button"
                                className="icon-btn is-danger"
                                title="Remove subtask"
                                onClick={() => removeSubtask(i)}
                              >
                                <Trash2 />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          <div className="form-bar">
            <span className="note">
              <Cloud />
              Fields marked * are required
            </span>
            <div className="actions">
              <Link className="btn btn-ghost" to={backTo} state={backState}>
                Cancel
              </Link>
              {!isEdit && (
                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => (addAnother.current = true)}
                >
                  <Plus />
                  Save &amp; add another
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                onClick={() => (addAnother.current = false)}
              >
                <Check />
                {isSubmitting
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : "Create task"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
