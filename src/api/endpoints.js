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
  addReview: (id, body) => data(api.post(`/projects/${id}/reviews`, body)),
  get: (id) => data(api.get(`/projects/${id}`)),
  create: (body) => data(api.post('/projects', body)),
  update: (id, body) => data(api.put(`/projects/${id}`, body)),
  remove: (id) => data(api.delete(`/projects/${id}`)),
};

export const timesheetsApi = {
  list: (params) => data(api.get('/timesheets', { params: toParams(params) })),
  summary: (scope) => data(api.get('/timesheets/summary', { params: { scope } })),
  options: () => data(api.get('/timesheets/options')),
  projects: () => data(api.get('/timesheets/projects')),
  get: (id) => data(api.get(`/timesheets/${id}`)),
  create: (body) => data(api.post('/timesheets', body)),
  update: (id, body) => data(api.put(`/timesheets/${id}`, body)),
  remove: (id) => data(api.delete(`/timesheets/${id}`)),
};

export const mastersApi = {
  list: (name) => data(api.get(`/masters/${name}`)),
  lookup: (type) => data(api.get(`/masters/lookups/${type}`)),
  currencies: () => data(api.get('/masters/currencies')),
};

/** Configuration screens (/config/<name>): parameters, sites, shifts, task-groups, task-types, project-divisions, project-types, customers */
export const configApi = (name) => ({
  list: (params) => data(api.get(`/config/${name}`, { params: toParams(params) })),
  get: (id) => data(api.get(`/config/${name}/${id}`)),
  create: (body) => data(api.post(`/config/${name}`, body)),
  update: (id, body) => data(api.put(`/config/${name}/${id}`, body)),
  remove: (id) => data(api.delete(`/config/${name}/${id}`)),
});
export const parameterTypes = () => data(api.get('/config/parameters/types'));
export const customerSummary = () => data(api.get('/config/customers/summary'));
