import { api } from './client';

const data = (p) => p.then((r) => r.data);

/** Drops empty values and joins arrays so the query string stays clean. */
export function toParams(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length) out[k] = v.join(',');
    } else out[k] = v;
  }
  return out;
}

export const authApi = {
  login: (body) => data(api.post('/auth/login', body)),
  logout: () => data(api.post('/auth/logout')),
  me: () => data(api.get('/auth/me')),
  changePassword: (body) => data(api.post('/auth/change-password', body)),
};

export const usersApi = {
  list: (params) => data(api.get('/users', { params: toParams(params) })),
  summary: () => data(api.get('/users/summary')),
  get: (id) => data(api.get(`/users/${id}`)),
  create: (body) => data(api.post('/users', body)),
  update: (id, body) => data(api.put(`/users/${id}`, body)),
  unlock: (id) => data(api.post(`/users/${id}/unlock`)),
  remove: (id) => data(api.delete(`/users/${id}`)),
};

export const rolesApi = {
  list: (params) => data(api.get('/roles', { params: toParams(params) })),
  options: () => data(api.get('/roles/options')),
  get: (id) => data(api.get(`/roles/${id}`)),
  create: (body) => data(api.post('/roles', body)),
  update: (id, body) => data(api.put(`/roles/${id}`, body)),
  remove: (id) => data(api.delete(`/roles/${id}`)),
  menus: () => data(api.get('/menus')),
};

export const projectsApi = {
  list: (params) => data(api.get('/projects', { params: toParams(params) })),
  summary: () => data(api.get('/projects/summary')),
  activity: (id) => data(api.get(`/projects/${id}/activity`)),
  reviews: (id) => data(api.get(`/projects/${id}/reviews`)),
  tasks: (id) => data(api.get(`/projects/${id}/tasks`)),
  // Plan tab (project owner): task groups per week
  plan: (id) => data(api.get(`/projects/${id}/plan`)),
  planAdd: (id, body) => data(api.post(`/projects/${id}/plan`, body)),
  planMove: (id, itemId, weekStart) => data(api.put(`/projects/${id}/plan/${itemId}`, { weekStart })),
  planSave: (id, items, confirmRemove = false) => data(api.put(`/projects/${id}/plan`, { items, ...(confirmRemove ? { confirmRemove } : {}) })), // replaces the whole plan
  planApply: (id, taskGroupIds) => data(api.post(`/projects/${id}/plan/apply`, { taskGroupIds })),
  planRemove: (id, itemId) => data(api.delete(`/projects/${id}/plan/${itemId}`)),
  memberRemovable: (id, userId) => data(api.get(`/projects/${id}/members/${userId}/removable`)),
  addReview: (id, body) => data(api.post(`/projects/${id}/reviews`, body)),
  get: (id) => data(api.get(`/projects/${id}`)),
  create: (body) => data(api.post('/projects', body)),
  update: (id, body) => data(api.put(`/projects/${id}`, body)),
  updateCommercial: (id, body) => data(api.put(`/projects/${id}/commercial`, body)),
  remove: (id) => data(api.delete(`/projects/${id}`)),
};

export const timesheetsApi = {
  list: (params) => data(api.get('/timesheets', { params: toParams(params) })),
  summary: (scope) => data(api.get('/timesheets/summary', { params: { scope } })),
  options: () => data(api.get('/timesheets/options')),
  meta: () => data(api.get('/timesheets/meta')), // task categories, all task groups / types, my tasks without a project
  projects: () => data(api.get('/timesheets/projects')),
  get: (id) => data(api.get(`/timesheets/${id}`)),
  create: (body) => data(api.post('/timesheets', body)),
  update: (id, body) => data(api.put(`/timesheets/${id}`, body)),
  remove: (id) => data(api.delete(`/timesheets/${id}`)),
};

export const tasksApi = {
  list: (params) => data(api.get('/tasks', { params: toParams(params) })),
  summary: (scope, employeeId) => data(api.get('/tasks/summary', { params: toParams({ scope, employeeId }) })),
  options: () => data(api.get('/tasks/options')),
  get: (id) => data(api.get(`/tasks/${id}`)),
  create: (body) => data(api.post('/tasks', body)),
  update: (id, body) => data(api.put(`/tasks/${id}`, body)),
  remove: (id) => data(api.delete(`/tasks/${id}`)),
  activity: (id) => data(api.get(`/tasks/${id}/activity`)),
  efforts: (id) => data(api.get(`/tasks/${id}/efforts`)), // time logged in the timesheet against the task
  // add from template
  templateProjects: () => data(api.get('/tasks/template-projects')),
  projectTemplates: (projectId) => data(api.get(`/tasks/template-projects/${projectId}/templates`)),
  fromTemplate: (body) => data(api.post('/tasks/from-template', body)),
  planTasks: (projectId) => data(api.get(`/tasks/template-projects/${projectId}/plan`)),
  fromPlan: (body) => data(api.post('/tasks/from-plan', body)),
  subtaskDone: (id, subtaskId, isDone) => data(api.put(`/tasks/${id}/subtasks/${subtaskId}/done`, { isDone })),
};

/** Task Master: who can see whose tasks / timesheets; the Employee filter's people */
export const taskAccessApi = {
  list: () => data(api.get('/task-access')),
  save: (viewerId, userIds) => data(api.put(`/task-access/${viewerId}`, { userIds })),
  visibleUsers: () => data(api.get('/task-access/visible-users')),
};

/** 1-3-5 planner (own items only) */
export const task135Api = {
  day: (date) => data(api.get('/task-135', { params: date ? { date } : {} })),
  subtasks: (search) => data(api.get('/task-135/subtasks', { params: search ? { search } : {} })), // open subtasks assigned to me
  add: (body) => data(api.post('/task-135', body)),
  update: (id, body) => data(api.put(`/task-135/${id}`, body)),
  reorder: (date, ids) => data(api.put('/task-135/reorder', { date, ids })),
  move: (id, date, mode) => data(api.post(`/task-135/${id}/move`, { date, mode })),
  remove: (id) => data(api.delete(`/task-135/${id}`)),
};

export const mastersApi = {
  list: (name, params) => data(api.get(`/masters/${name}`, { params })),
  lookup: (type) => data(api.get(`/masters/lookups/${type}`)),
  currencies: () => data(api.get('/masters/currencies')),
};

/** Configuration screens (/config/<name>): parameters, sites, task-groups (with their task types), project-divisions, project-types, customers */
export const configApi = (name) => ({
  list: (params) => data(api.get(`/config/${name}`, { params: toParams(params) })),
  get: (id) => data(api.get(`/config/${name}/${id}`)),
  create: (body) => data(api.post(`/config/${name}`, body)),
  update: (id, body) => data(api.put(`/config/${name}/${id}`, body)),
  remove: (id) => data(api.delete(`/config/${name}/${id}`)),
});
export const parameterTypes = () => data(api.get('/config/parameters/types'));
export const customerSummary = () => data(api.get('/config/customers/summary'));
