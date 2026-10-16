import axios from 'axios';

// The access token lives in memory only (not localStorage). The refresh token is an
// httpOnly cookie set by the API, so a page reload restores the session via /auth/refresh.
let accessToken = null;
let onSessionExpired = () => {};

export const setAccessToken = (token) => {
  accessToken = token;
};
export const setSessionExpiredHandler = (fn) => {
  onSessionExpired = fn;
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  withCredentials: true,
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// One refresh at a time: parallel 401s wait for the same promise.
let refreshing = null;
export function refreshSession() {
  refreshing ??= axios
    .post(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true })
    .then((res) => {
      setAccessToken(res.data.accessToken);
      return res.data;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

const NO_RETRY = ['/auth/login', '/auth/refresh', '/auth/logout'];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    if (status === 401 && original && !original._retried && !NO_RETRY.some((p) => original.url?.endsWith(p))) {
      original._retried = true;
      try {
        await refreshSession();
        return api(original);
      } catch {
        setAccessToken(null);
        onSessionExpired();
      }
    }
    return Promise.reject(error);
  },
);

/** Human-readable message from an API error ({ statusCode, code, message, details }). */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection.';
  return error?.message || fallback;
}

/** Field errors from a 400 response, as { fieldName: message }. */
export function fieldErrors(error) {
  const details = error?.response?.data?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(details.filter((d) => d.field).map((d) => [d.field, d.message]));
}
