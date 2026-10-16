import { useQuery } from '@tanstack/react-query';
import { mastersApi, parameterTypes, rolesApi } from '@/api/endpoints';

const STALE = 5 * 60 * 1000;
const toOptions = (rows, label = (r) => r.name) => (rows ?? []).map((r) => ({ value: r.id, label: label(r) }));

/** Dropdown options from /masters/<name> as [{ value, label }]. */
export function useMasterOptions(name, { label, enabled = true } = {}) {
  const q = useQuery({ queryKey: ['masters', name], queryFn: () => mastersApi.list(name), staleTime: STALE, enabled });
  return { options: toOptions(q.data, label), isLoading: q.isLoading };
}

export function useLookupOptions(type) {
  const q = useQuery({ queryKey: ['lookups', type], queryFn: () => mastersApi.lookup(type), staleTime: STALE });
  return { options: toOptions(q.data), isLoading: q.isLoading };
}

/** Project stages as options; `status` is the category the stage counts as. */
export function useStageOptions() {
  const q = useQuery({ queryKey: ['lookups', 'PROJECT_STAGE'], queryFn: () => mastersApi.lookup('PROJECT_STAGE'), staleTime: STALE });
  return { options: (q.data ?? []).map((r) => ({ value: r.id, label: r.name, status: r.code })), isLoading: q.isLoading };
}

export function useCurrencyOptions() {
  const q = useQuery({ queryKey: ['masters', 'currencies'], queryFn: mastersApi.currencies, staleTime: STALE });
  return (q.data ?? ['INR']).map((c) => ({ value: c, label: c }));
}

/** Roles the signed-in user may assign (level rule applied by the API). */
export function useAssignableRoleOptions() {
  const q = useQuery({ queryKey: ['roles', 'options'], queryFn: rolesApi.options, staleTime: STALE });
  return { options: toOptions(q.data), roles: q.data ?? [], isLoading: q.isLoading };
}

/**
 * Options described by a config screen: { master: 'task-groups' } | { lookup: 'COUNTRY' } | { parameterTypes: true }.
 * Shares the query cache with useMasterOptions / useLookupOptions.
 */
export function useOptionsFrom(src, staticOptions) {
  const key = !src ? ['none'] : src.master ? ['masters', src.master] : src.lookup ? ['lookups', src.lookup] : ['config', 'parameter-types'];
  const q = useQuery({
    queryKey: key,
    queryFn: () => (src.master ? mastersApi.list(src.master) : src.lookup ? mastersApi.lookup(src.lookup) : parameterTypes()),
    enabled: !!src,
    staleTime: STALE,
  });
  if (!src) return staticOptions ?? [];
  if (src.parameterTypes) return (q.data ?? []).map((t) => ({ value: t, label: t }));
  return toOptions(q.data);
}
