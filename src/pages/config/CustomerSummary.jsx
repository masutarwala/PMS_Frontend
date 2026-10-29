import { useQuery } from '@tanstack/react-query';
import { Building2, FolderKanban, Globe, UserX } from 'lucide-react';
import { customerSummary } from '@/api/endpoints';
import { AlertCard, AreaCard, ColumnsCard, KpiSection, PieCard } from '@/components/ui/MetricCards';

const SHORT = { 'Contact person': 'contact', Email: 'email', Phone: 'phone' };

/**
 * Customers list cards, from the data a customer has:
 *   count & trend · country split · projects running · missing contact details (data to fix)
 */
export function CustomerSummary() {
  const { data: s } = useQuery({ queryKey: ['config', 'customers', 'summary'], queryFn: customerSummary });
  const months = s?.projectsRunning.byMonth ?? [];
  const gaps = s?.missingContact;
  return (
    <KpiSection storageKey="customers">
      <AreaCard
        title="Customers"
        icon={Building2}
        value={s?.total}
        trend={s?.createdThisQuarter ? { value: s.createdThisQuarter, label: 'this quarter' } : null}
        subs={s && [[s.active, 'Active'], [s.inactive, 'Inactive']]}
        series={s?.totalByMonth}
      />
      <PieCard
        title="By country"
        icon={Globe}
        caption="customers"
        pill={s ? `${s.byCountry.length} countries` : undefined}
        items={(s?.byCountry ?? []).map((c) => ({ key: c.id ?? 'none', label: c.name, value: c.count }))}
      />
      <ColumnsCard
        title="Projects running"
        icon={FolderKanban}
        value={s?.projectsRunning.total}
        subs={s && [[s.projectsRunning.customers, 'Customers'], [s.projectsRunning.retainer, 'Retainer']]}
        bars={months.map((m) => ({ value: m.count, label: String(m.count) }))}
        days={months.map((m) => m.label[0])}
        highlight={months.length - 1}
      />
      <AlertCard
        title="Missing contacts"
        icon={UserX}
        value={gaps?.total}
        badge="To complete"
        items={(gaps?.items ?? []).map((g) => ({
          key: g.id,
          name: g.name,
          label: g.name,
          pill: g.missing.length === 3 ? 'No details' : `No ${g.missing.map((m) => SHORT[m] ?? m).join(', ')}`,
        }))}
        more={(gaps?.total ?? 0) - (gaps?.items.length ?? 0)}
        emptyText="Every active customer has a contact person, email and phone"
      />
    </KpiSection>
  );
}
