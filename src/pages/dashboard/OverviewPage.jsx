import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BadgeCheck, CalendarCheck, ChartPie, CircleCheck, Clock3, FolderKanban, Gauge, LayoutGrid, Sparkles, TriangleAlert, UserRound } from 'lucide-react';
import { projectsApi } from '@/api/endpoints';
import { useAuth } from '@/auth/auth-context';
import { Topbar } from '@/components/layout/Topbar';
import { MenuIcon } from '@/components/layout/icons';
import { ColumnsCard, DonutCard, GaugeCard, WatermarkCard } from '@/components/ui/MetricCards';
import { PERMISSION_ACTIONS, SCREENS } from '@/lib/constants';
import { formatNumber } from '@/lib/format';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const todayIndex = () => (new Date().getDay() + 6) % 7; // Monday = 0

const plural = (n, word) => `${word}${n === 1 ? '' : 's'}`;

/** Greeting banner from the design (Screens/index.html `.hello`). */
function Hello({ user, s }) {
  const week = s?.hoursThisMonth.week ?? [];
  const weekHours = week.reduce((a, b) => a + b, 0);
  const todayHours = week[todayIndex()] ?? 0;
  const month = s?.hoursThisMonth;
  const billablePct = month?.total ? Math.round((month.billable / month.total) * 100) : 0;
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="hello">
      <div>
        <div className="date">{date}</div>
        {s ? (
          <p>
            You have <b>{formatNumber(s.active)} active {plural(s.active, 'project')}</b>
            {s.overdue > 0 ? (
              <>
                {' '}
                and <b>{formatNumber(s.overdue)} past {s.overdue === 1 ? 'its' : 'their'} end date</b>
              </>
            ) : null}
            . Your team logged <b>{formatNumber(month.total)} hours</b> this month
            {month.total > 0 ? (
              <>
                {' '}
                – <b>{billablePct}%</b> of it billable
              </>
            ) : null}
            .
          </p>
        ) : (
          <p>
            Signed in as <b>{user.role.name}</b>. Pick a screen below to get started.
          </p>
        )}
        {s && (
          <div className="pills">
            <span className="pill">
              <span className="i">
                <FolderKanban />
              </span>
              <b>{formatNumber(s.active)}</b> active projects
            </span>
            <span className="pill">
              <span className="i">
                <UserRound />
              </span>
              <b>{formatNumber(s.mine)}</b> my projects
            </span>
            <span className="pill">
              <span className="i">
                <CalendarCheck />
              </span>
              <b>{formatNumber(weekHours)}h</b> logged this week
            </span>
          </div>
        )}
      </div>
      <div className="hello-art" aria-hidden="true">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="note n1">
          <CircleCheck />
          {s ? `${formatNumber(s.byStatus.completed)} completed` : user.role.name}
        </span>
        <span className="note n2">
          <Clock3 />
          {formatNumber(todayHours)}h logged today
        </span>
        <span className="note n3">
          <BadgeCheck />
          {user.role.name}
        </span>
      </div>
    </div>
  );
}

function ProjectCards({ s }) {
  const open = s.total - s.byStatus.completed - s.byStatus.cancelled;
  const donePct = s.total ? (s.byStatus.completed / s.total) * 100 : 0;
  const { onTrack, atRisk, late } = s.activeHealth;
  const month = s.hoursThisMonth;
  return (
    <div className="grid grid-4" style={{ marginBottom: 20 }}>
      <WatermarkCard
        title="Projects"
        icon={LayoutGrid}
        value={s.total}
        subs={[
          [open, 'Open'],
          [s.createdThisMonth, 'This month'],
        ]}
      />
      <ColumnsCard
        title="Hours this month"
        icon={Clock3}
        value={month.total}
        unit="h"
        subs={[
          [month.billable, 'Billable'],
          [month.internal, 'Internal'],
        ]}
        bars={month.week.map((h) => ({ value: h, label: `${formatNumber(h)}h` }))}
        days={DAYS}
        highlight={todayIndex()}
      />
      <DonutCard
        title="Completed projects"
        icon={ChartPie}
        percent={donePct}
        value={s.byStatus.completed}
        legend={[
          ['Done', donePct, '#16A34A'],
          ['Remaining', 100 - donePct, 'var(--surface-3)'],
        ]}
      />
      <GaugeCard
        title="On schedule"
        icon={Gauge}
        value={onTrack}
        max={s.active}
        unit={plural(s.active, 'project')}
        caption="on track"
        pill={late ? `${late} late` : atRisk ? `${atRisk} at risk` : 'On track'}
      />
    </div>
  );
}

function ScheduleAlert({ s }) {
  if (s.overdue > 0) {
    return (
      <div className="alert alert-warning" style={{ marginBottom: 20 }}>
        <TriangleAlert />
        <div>
          <b>{formatNumber(s.overdue)}</b> active {plural(s.overdue, 'project')} {s.overdue === 1 ? 'is' : 'are'} past the end date
          {s.activeHealth.atRisk > 0 ? ` and ${s.activeHealth.atRisk} end within the next two weeks` : ''}.{' '}
          <Link to="/projects">
            <b>Review projects</b>
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="alert alert-success" style={{ marginBottom: 20 }}>
      <Sparkles />
      <div>
        All active projects are on schedule
        {s.activeHealth.atRisk > 0 ? ` – ${s.activeHealth.atRisk} end within the next two weeks` : ''}.
      </div>
    </div>
  );
}

/** One card per menu module with its screens, like the design's module list. */
function ModuleCards({ menus, can }) {
  const allowed = (url) => PERMISSION_ACTIONS.filter((a) => can(url, a.key)).map((a) => a.label).join(' · ');
  return (
    <div className="grid grid-2">
      {menus
        .filter((m) => m.children.length)
        .map((m) => (
          <div key={m.id} className="card card-flush">
            <div className="card-head">
              <span className="nav-ico" style={{ background: 'var(--green-50)', color: 'var(--green-700)' }}>
                <MenuIcon name={m.icon} />
              </span>
              <div>
                <h3>{m.name}</h3>
                <div className="sub">
                  {m.children.length} {plural(m.children.length, 'screen')}
                </div>
              </div>
            </div>
            <div className="list" style={{ marginTop: 12 }}>
              {m.children.map((c) => (
                <Link key={c.id} className="list-item" to={c.url} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <span className="body">
                    <span className="title">{c.name}</span>
                    <span className="meta">
                      <span>{allowed(c.url) || 'View'}</span>
                    </span>
                  </span>
                  <span className="trail">
                    <ArrowRight />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

export default function OverviewPage() {
  const { user, can, session } = useAuth();
  const canProjects = can(SCREENS.PROJECTS, 'view');
  const { data: s } = useQuery({ queryKey: ['projects', 'summary'], queryFn: projectsApi.summary, enabled: canProjects });

  return (
    <>
      <Topbar title="Overview" breadcrumb={['emQube PMS']} />
      <Hello user={user} s={canProjects ? s : null} />
      {canProjects && s && (
        <>
          <ProjectCards s={s} />
          <ScheduleAlert s={s} />
        </>
      )}
      <ModuleCards menus={session.menus} can={can} />
    </>
  );
}
