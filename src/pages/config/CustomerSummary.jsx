import { useQuery } from '@tanstack/react-query';
import { Building2, FolderKanban, MapPin, UserCheck } from 'lucide-react';
import { customerSummary } from '@/api/endpoints';
import { AreaCard, ColumnsCard, KpiSection, RowsCard, WatermarkCard } from '@/components/ui/MetricCards';

/** Customers list cards (design: area · rows · columns · watermark). */
export function CustomerSummary() {
  const { data: s } = useQuery({ queryKey: ['config', 'customers', 'summary'], queryFn: customerSummary });
  const months = s?.projectsRunning.byMonth ?? [];
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
      <RowsCard title="Active customers" icon={UserCheck} value={s?.active} rows={s ? [['Active', s.active], ['Inactive', s.inactive]] : []} />
      <ColumnsCard
        title="Projects running"
        icon={FolderKanban}
        value={s?.projectsRunning.total}
        subs={s && [[s.projectsRunning.fixed, 'Fixed scope'], [s.projectsRunning.retainer, 'Retainer']]}
        bars={months.map((m) => ({ value: m.count, label: String(m.count) }))}
        days={months.map((m) => m.label[0])}
        highlight={months.length - 1}
      />
      <WatermarkCard
        title="Locations"
        icon={MapPin}
        value={s?.locations.total}
        subs={s && [[s.locations.customersWith, 'With locations'], [s.locations.customersWithout, 'Without']]}
      />
    </KpiSection>
  );
}
