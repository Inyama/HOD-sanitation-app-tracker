/** Screen titles and build phases for placeholders (spec 7.2 to 7.4, 14). */

export interface ScreenInfo {
  title: string;
  phase: number;
  points: string[];
}

export const SCREENS: Record<string, ScreenInfo> = {
  "/member/check-in": {
    title: "Check in",
    phase: 3,
    points: [
      "Location permission, accuracy meter and map",
      "On time or Late from the server clock",
      "Simulate time and location in demo mode",
    ],
  },
  "/member/attendance": {
    title: "My attendance",
    phase: 3,
    points: ["Full history with filters", "12-month heatmap", "Export my data as CSV"],
  },
  "/member/performance": {
    title: "My performance",
    phase: 3,
    points: ["Monthly percentage chart", "Saturday versus Thursday", "Badges"],
  },
  "/member/schedule": {
    title: "Schedule",
    phase: 3,
    points: ["List and month calendar", "Add to calendar (.ics, Google, Outlook)"],
  },
  "/member/notifications": {
    title: "Notifications",
    phase: 3,
    points: ["Reminders, late notices and announcements", "Mark all read, filter by type"],
  },
  "/member/excuses": {
    title: "Excuse requests",
    phase: 3,
    points: ["Request an excuse with optional proof", "See admin decisions"],
  },
  "/member/messages": { title: "Messages", phase: 3, points: ["Messages from admins with search"] },
  "/member/report": { title: "My report", phase: 3, points: ["Choose a period and download a PDF statement"] },
  "/member/help": { title: "Help and guidelines", phase: 3, points: ["Unit rules, lateness policy, FAQs"] },
  "/member/settings": {
    title: "Profile and settings",
    phase: 3,
    points: ["Details, time zone, reminder channels, quiet hours", "Privacy: data export and deletion request"],
  },
  "/volunteer/events": {
    title: "Events and schedule",
    phase: 4,
    points: ["Upcoming events with RSVP", "Admin updates pinned at the top"],
  },
  "/volunteer/attendance": {
    title: "My attendance",
    phase: 4,
    points: ["Same percentage, band, history and heatmap as members"],
  },
  "/volunteer/duties": {
    title: "Duty board",
    phase: 4,
    points: ["Open tasks by zone for the next Saturday", "Sign up, withdraw, request a swap"],
  },
  "/volunteer/hours": {
    title: "Service hours",
    phase: 4,
    points: ["Automatic and manual hours", "Monthly chart and yearly certificate"],
  },
  "/volunteer/issues": { title: "Report an issue", phase: 4, points: ["Photo, area, urgency and status tracker"] },
  "/volunteer/marshal": {
    title: "Marshal tools",
    phase: 4,
    points: ["Live present, late and expected lists", "Manual check-in", "Rotating QR code"],
  },
  "/volunteer/team": { title: "My team", phase: 4, points: ["Team members with percentages", "Send encouragement"] },
  "/volunteer/messages": { title: "Messages", phase: 4, points: ["Messages from admins"] },
  "/volunteer/settings": { title: "Settings", phase: 4, points: ["Same as the member settings"] },
  "/admin/live": { title: "Live Saturday board", phase: 6, points: ["Map with check-in dots and live counters"] },
  "/admin/members": { title: "Members directory", phase: 5, points: ["Search, filters, bulk actions, import"] },
  "/admin/approvals": {
    title: "Pending approvals",
    phase: 5,
    points: ["Approve or reject with a reason, bulk approve"],
  },
  "/admin/uploads": { title: "Attendance upload", phase: 6, points: ["Upload wizard with match preview and rollback"] },
  "/admin/meetings": { title: "Meetings and events", phase: 6, points: ["Create, edit, cancel and reschedule"] },
  "/admin/excuses": { title: "Excuse requests", phase: 6, points: ["Queue with proof preview"] },
  "/admin/corrections": {
    title: "Corrections and disputes",
    phase: 6,
    points: ["Flagged and manual check-ins, before and after"],
  },
  "/admin/duties": { title: "Duty roster and zones", phase: 6, points: ["Drag-and-drop board, publish to volunteers"] },
  "/admin/reports": { title: "Reports and exports", phase: 6, points: ["CSV, XLSX and PDF with the logo"] },
  "/admin/analytics": {
    title: "Performance analytics",
    phase: 6,
    points: ["Cohorts, punctuality, drop-off, leaderboards"],
  },
  "/admin/messages": {
    title: "Messaging center",
    phase: 7,
    points: ["Audience builder, templates, delivery report", "Announcements"],
  },
  "/admin/automation": {
    title: "Reminders and automation",
    phase: 7,
    points: ["Automated notifications, templates and delivery log"],
  },
  "/admin/roles": { title: "Roles and titles", phase: 5, points: ["Assign roles, admin levels and titles"] },
  "/admin/audit": { title: "Audit log", phase: 5, points: ["Who, what, when, from where; export"] },
  "/admin/settings": { title: "Settings", phase: 5, points: ["Venue pin and radius, windows, thresholds, demo mode"] },
};
