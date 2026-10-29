import { createElement } from 'react';
import {
  Building2,
  CalendarRange,
  ClipboardList,
  ListOrdered,
  Clock3,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Settings2,
  ShieldCheck,
  Users,
  Circle,
} from 'lucide-react';

// menus.icon (lucide kebab-case name stored in the DB) → component.
// Add an entry here when a new module icon is used in the menus table.
const ICONS = {
  'building-2': Building2,
  'calendar-range': CalendarRange,
  'clipboard-list': ClipboardList,
  'list-ordered': ListOrdered,
  'clock-3': Clock3,
  'folder-kanban': FolderKanban,
  'layout-dashboard': LayoutDashboard,
  'list-checks': ListChecks,
  'settings-2': Settings2,
  'shield-check': ShieldCheck,
  users: Users,
};

export const menuIcon = (name) => ICONS[name] ?? Circle;

/** <MenuIcon name="folder-kanban" /> */
export function MenuIcon({ name }) {
  return createElement(menuIcon(name));
}
