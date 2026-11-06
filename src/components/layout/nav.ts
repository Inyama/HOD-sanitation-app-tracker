import {
  Award,
  Bell,
  CalendarDays,
  ChartLine,
  CircleHelp,
  ClipboardList,
  Clock3,
  FileText,
  Gauge,
  HeartHandshake,
  History,
  Home,
  Inbox,
  LayoutDashboard,
  ListTodo,
  MapPin,
  Megaphone,
  MessageSquare,
  QrCode,
  Radio,
  ScrollText,
  Settings,
  ShieldCheck,
  TriangleAlert,
  Upload,
  UserCheck,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type ShellRole = "member" | "volunteer" | "admin";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the phone bottom bar (max 4; "More" is added automatically). */
  primary?: boolean;
  badge?: number;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV: Record<ShellRole, NavGroup[]> = {
  member: [
    {
      items: [
        { href: "/member", label: "Home", icon: Home, primary: true },
        { href: "/member/check-in", label: "Check-in", icon: MapPin, primary: true },
        { href: "/member/attendance", label: "Attendance", icon: CalendarDays, primary: true },
        { href: "/member/notifications", label: "Alerts", icon: Bell, primary: true },
      ],
    },
    {
      label: "My progress",
      items: [
        { href: "/member/performance", label: "Performance", icon: ChartLine },
        { href: "/member/report", label: "My report", icon: FileText },
        { href: "/member/excuses", label: "Excuse requests", icon: ShieldCheck },
      ],
    },
    {
      label: "Stay in touch",
      items: [
        { href: "/member/schedule", label: "Schedule", icon: Clock3 },
        { href: "/member/messages", label: "Messages", icon: Inbox },
        { href: "/member/help", label: "Help and guidelines", icon: CircleHelp },
        { href: "/member/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
  volunteer: [
    {
      items: [
        { href: "/volunteer", label: "Home", icon: Home, primary: true },
        { href: "/volunteer/events", label: "Events", icon: Megaphone, primary: true },
        { href: "/volunteer/duties", label: "Duties", icon: ListTodo, primary: true },
        { href: "/volunteer/attendance", label: "Attendance", icon: CalendarDays, primary: true },
      ],
    },
    {
      label: "Serve",
      items: [
        { href: "/volunteer/hours", label: "Service hours", icon: Clock3 },
        { href: "/volunteer/issues", label: "Report an issue", icon: Wrench },
        { href: "/volunteer/marshal", label: "Marshal tools", icon: QrCode },
        { href: "/volunteer/team", label: "My team", icon: HeartHandshake },
      ],
    },
    {
      label: "Me",
      items: [
        { href: "/member", label: "My member view", icon: UserCheck },
        { href: "/volunteer/messages", label: "Messages", icon: Inbox },
        { href: "/volunteer/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
  admin: [
    {
      items: [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard, primary: true },
        { href: "/admin/live", label: "Live board", icon: Radio, primary: true },
        { href: "/admin/members", label: "Members", icon: Users, primary: true },
        { href: "/admin/approvals", label: "Approvals", icon: UserCheck, primary: true },
      ],
    },
    {
      label: "Attendance",
      items: [
        { href: "/admin/uploads", label: "Sheet uploads", icon: Upload },
        { href: "/admin/meetings", label: "Meetings", icon: CalendarDays },
        { href: "/admin/excuses", label: "Excuses", icon: ShieldCheck },
        { href: "/admin/corrections", label: "Corrections", icon: TriangleAlert },
        { href: "/admin/duties", label: "Duty roster", icon: ClipboardList },
      ],
    },
    {
      label: "Insight",
      items: [
        { href: "/admin/reports", label: "Reports", icon: FileText },
        { href: "/admin/analytics", label: "Analytics", icon: Gauge },
      ],
    },
    {
      label: "Communicate",
      items: [
        { href: "/admin/messages", label: "Messaging", icon: MessageSquare },
        { href: "/admin/automation", label: "Automation", icon: Zap },
      ],
    },
    {
      label: "System",
      items: [
        { href: "/admin/roles", label: "Roles and titles", icon: Award },
        { href: "/admin/audit", label: "Audit log", icon: History },
        { href: "/admin/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
};

export const ROLE_META: Record<ShellRole, { label: string; home: string; icon: LucideIcon }> = {
  member: { label: "Member", home: "/member", icon: UserCheck },
  volunteer: { label: "Volunteer", home: "/volunteer", icon: HeartHandshake },
  admin: { label: "Admin", home: "/admin", icon: ScrollText },
};

export function isActive(pathname: string, href: string, home: string): boolean {
  if (href === home) return pathname === home;
  return pathname === href || pathname.startsWith(`${href}/`);
}
