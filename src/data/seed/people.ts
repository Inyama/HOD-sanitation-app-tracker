import type { AdminLevel, Role, TitleCode, UserStatus } from "@/lib/repo/types";

/** People definitions for the seed (spec 10.2 to 10.4). */

export type Profile = "reliable" | "regular" | "casual" | "struggling";

export const PROFILE_RULES: Record<Profile, { attend: number; late: number }> = {
  reliable: { attend: 0.92, late: 0.08 },
  regular: { attend: 0.82, late: 0.15 },
  casual: { attend: 0.68, late: 0.22 },
  struggling: { attend: 0.45, late: 0.35 },
};

/** Approval cohorts (spec 10.3): 40 at 12 months, 14 at 6 months, 10 recent (6 approved + 4 pending). */
export type Cohort = "year" | "half" | "recent" | "pending";

export interface PersonDef {
  key: string;
  name: string;
  email: string;
  role: Role;
  adminLevel?: AdminLevel;
  status: UserStatus;
  cohort: Cohort;
  profile: Profile;
  titles?: TitleCode[];
  isRemote?: boolean;
  city?: string;
  country?: string;
  timezone?: string;
  /** Planted attendance pattern key (see planted.ts). */
  planted?: string;
  /** Demo account target shown on /dev/data and asserted by tests. */
  target?: string;
}

export const DEMO_PASSWORD = "Demo@2026";

/** The demo accounts from spec 10.4, plus the Unit Admin needed to make five admins. */
export const DEMO_ACCOUNTS: PersonDef[] = [
  {
    key: "adebayo",
    name: "Adebayo Johnson",
    email: "member@hod-demo.example.com",
    role: "MEMBER",
    status: "ACTIVE",
    cohort: "year",
    profile: "regular",
    planted: "adebayo",
    target: "88 percent, 6-meeting streak, 2 badges",
  },
  {
    key: "chioma",
    name: "Chioma Okafor",
    email: "chioma@hod-demo.example.com",
    role: "MEMBER",
    status: "ACTIVE",
    cohort: "year",
    profile: "struggling",
    planted: "chioma",
    target: "52 percent (amber), low-attendance nudge, pending excuse",
  },
  {
    key: "ngozi",
    name: "Ngozi Eze",
    email: "gold@hod-demo.example.com",
    role: "MEMBER",
    status: "ACTIVE",
    cohort: "year",
    profile: "reliable",
    planted: "ngozi",
    target: "exactly 90.0 percent",
  },
  {
    key: "emeka",
    name: "Emeka Obi",
    email: "almost@hod-demo.example.com",
    role: "MEMBER",
    status: "ACTIVE",
    cohort: "half",
    profile: "reliable",
    planted: "emeka",
    target: "89.7 percent",
  },
  {
    key: "tobi",
    name: "Tobi Martins",
    email: "new@hod-demo.example.com",
    role: "MEMBER",
    status: "ACTIVE",
    cohort: "recent",
    profile: "regular",
    planted: "tobi",
    target: "joined 3 weeks ago, 5 meetings",
  },
  {
    key: "ruth",
    name: "Ruth Williams",
    email: "remote@hod-demo.example.com",
    role: "MEMBER",
    status: "ACTIVE",
    cohort: "year",
    profile: "regular",
    isRemote: true,
    city: "London",
    country: "United Kingdom",
    timezone: "Europe/London",
    target: "Remote, Thursday sheet only",
  },
  {
    key: "grace",
    name: "Grace Adeyemi",
    email: "volunteer@hod-demo.example.com",
    role: "VOLUNTEER",
    status: "ACTIVE",
    cohort: "year",
    profile: "reliable",
    titles: ["TEAM_LEAD", "MARSHAL"],
    planted: "grace",
    target: "94 percent, Team Lead and Marshal, 31 service hours",
  },
  {
    key: "michael",
    name: "Michael Danjuma",
    email: "volunteer2@hod-demo.example.com",
    role: "VOLUNTEER",
    status: "ACTIVE",
    cohort: "year",
    profile: "casual",
    titles: ["SUPPLIES_KEEPER"],
    planted: "michael",
    target: "71 percent, Supplies Keeper",
  },
  {
    key: "daniel",
    name: "Pastor Daniel Ojo",
    email: "admin@hod-demo.example.com",
    role: "ADMIN",
    adminLevel: "SUPER",
    status: "ACTIVE",
    cohort: "year",
    profile: "reliable",
    target: "Super Admin, full access",
  },
  {
    key: "funke",
    name: "Funke Lawal",
    email: "unit@hod-demo.example.com",
    role: "ADMIN",
    adminLevel: "UNIT",
    status: "ACTIVE",
    cohort: "year",
    profile: "reliable",
    target: "Unit Admin (added so there are five admins)",
  },
  {
    key: "esther",
    name: "Esther Bamidele",
    email: "attendance@hod-demo.example.com",
    role: "ADMIN",
    adminLevel: "ATTENDANCE_OFFICER",
    status: "ACTIVE",
    cohort: "year",
    profile: "regular",
    target: "Attendance Officer: uploads and exports only",
  },
  {
    key: "joshua",
    name: "Joshua Akande",
    email: "comms@hod-demo.example.com",
    role: "ADMIN",
    adminLevel: "COMMS_OFFICER",
    status: "ACTIVE",
    cohort: "year",
    profile: "regular",
    target: "Communications Officer: messaging only",
  },
  {
    key: "naomi",
    name: "Naomi Fashola",
    email: "auditor@hod-demo.example.com",
    role: "ADMIN",
    adminLevel: "AUDITOR",
    status: "ACTIVE",
    cohort: "year",
    profile: "reliable",
    target: "Auditor: read-only",
  },
  {
    key: "samuel",
    name: "Samuel Bello",
    email: "pending@hod-demo.example.com",
    role: "MEMBER",
    status: "PENDING",
    cohort: "pending",
    profile: "regular",
    target: "In the approval queue",
  },
  {
    key: "victor",
    name: "Victor Nwosu",
    email: "suspended@hod-demo.example.com",
    role: "MEMBER",
    status: "SUSPENDED",
    cohort: "year",
    profile: "struggling",
    target: "Suspended: cannot sign in",
  },
];

export const FIRST_NAMES = [
  "Tobi",
  "Funke",
  "Amara",
  "Daniel",
  "Samuel",
  "Blessing",
  "Peter",
  "Mercy",
  "Victor",
  "Kemi",
  "David",
  "Tolu",
  "Sarah",
  "Ife",
  "Hannah",
  "Segun",
  "Precious",
  "Joshua",
  "Esther",
  "Michael",
  "Ruth",
  "Naomi",
  "Ngozi",
  "Emeka",
  "Chidi",
  "Bisi",
  "Yemi",
  "Femi",
  "Zainab",
  "Joy",
  "Faith",
  "Gbenga",
  "Nkechi",
  "Uche",
  "Rachel",
  "Kwame",
];

export const SURNAMES = [
  "Adeyemi",
  "Okafor",
  "Johnson",
  "Eze",
  "Bello",
  "Williams",
  "Obi",
  "Martins",
  "Akande",
  "Fashola",
  "Danjuma",
  "Bamidele",
  "Ojo",
  "Nwosu",
  "Lawal",
  "Ibrahim",
  "Mensah",
  "Smith",
  "Okon",
  "Adebayo",
  "Balogun",
  "Uzor",
];

/** Counts of generated (non-demo) people per role and cohort, chosen so the totals match spec 10.2. */
export const GENERATED_PLAN: { role: Role; cohort: Cohort; count: number }[] = [
  { role: "MEMBER", cohort: "year", count: 23 },
  { role: "VOLUNTEER", cohort: "year", count: 5 },
  { role: "MEMBER", cohort: "half", count: 9 },
  { role: "VOLUNTEER", cohort: "half", count: 4 },
  { role: "MEMBER", cohort: "recent", count: 5 },
  { role: "MEMBER", cohort: "pending", count: 2 },
  { role: "VOLUNTEER", cohort: "pending", count: 1 },
];

export const OTHER_CITIES: { city: string; country: string; timezone: string }[] = [
  { city: "Lagos", country: "Nigeria", timezone: "Africa/Lagos" },
  { city: "Ikeja", country: "Nigeria", timezone: "Africa/Lagos" },
  { city: "Lekki", country: "Nigeria", timezone: "Africa/Lagos" },
  { city: "Surulere", country: "Nigeria", timezone: "Africa/Lagos" },
  { city: "Ogba", country: "Nigeria", timezone: "Africa/Lagos" },
  { city: "Ibadan", country: "Nigeria", timezone: "Africa/Lagos" },
];
