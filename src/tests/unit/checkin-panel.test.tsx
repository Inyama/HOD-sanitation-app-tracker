import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckInPanel, type CheckInPanelProps } from "@/components/attendance/CheckInPanel";
import { freezeTime } from "@/lib/time/clock";
import { lagosTime } from "@/lib/time/zone";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/components/attendance/CheckInMap", () => ({ CheckInMap: () => <div data-testid="map" /> }));

const meeting = {
  id: "mtg-2026-11-07-sat",
  type: "SATURDAY" as const,
  title: "Saturday Sanitation Meeting",
  startsAt: lagosTime(2026, 11, 7, 9, 30).toISO()!,
  endsAt: null,
  status: "SCHEDULED" as const,
  statusNote: null,
  method: "GEO" as const,
  graceMinutes: 0,
  openBeforeMin: 60,
  closeAfterMin: 120,
  requireQr: false,
};
const base: CheckInPanelProps = {
  meeting,
  venue: { name: "HOD Ikeja", address: "7 Surulere Industrial Road", lat: 6.6018, lng: 3.3515, radiusM: 100 },
  maxAccuracyM: 50,
  existing: null,
  percent: 88,
  isRemote: false,
  demo: true,
};

async function locateWith(label: RegExp) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: label }));
  await user.click(screen.getByRole("button", { name: "Find my location" }));
}

describe("CheckInPanel states (spec 7.2)", () => {
  it("before 08:30 says check-in is not open yet", async () => {
    freezeTime(lagosTime(2026, 11, 7, 8, 25));
    render(<CheckInPanel {...base} />);
    expect(await screen.findByText("Check-in is not open yet")).toBeInTheDocument();
  });

  it("after 11:30 says check-in has closed", async () => {
    freezeTime(lagosTime(2026, 11, 7, 11, 31));
    render(<CheckInPanel {...base} />);
    expect(await screen.findByText("Check-in has closed")).toBeInTheDocument();
  });

  it("inside the radius offers Confirm check-in", async () => {
    freezeTime(lagosTime(2026, 11, 7, 9, 20));
    render(<CheckInPanel {...base} />);
    await locateWith(/^At the venue\s*25 m/);
    expect(await screen.findByText("You are inside the check-in area.", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm check-in" })).toBeEnabled();
    expect(screen.getByText("25 m")).toBeInTheDocument();
  });

  it("2 km away shows the distance and Get directions", async () => {
    freezeTime(lagosTime(2026, 11, 7, 9, 20));
    render(<CheckInPanel {...base} />);
    await locateWith(/2 km away/);
    expect(await screen.findByText(/outside the 100 m check-in area/, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Get directions/ })).toHaveAttribute(
      "href",
      expect.stringContaining("google.com/maps"),
    );
  });

  it("poor accuracy asks to move outdoors and retry", async () => {
    freezeTime(lagosTime(2026, 11, 7, 9, 20));
    render(<CheckInPanel {...base} />);
    await locateWith(/Poor accuracy/);
    expect(
      await screen.findByRole("button", { name: "Move outdoors and retry" }, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it("no GPS offers to ask a marshal", async () => {
    freezeTime(lagosTime(2026, 11, 7, 9, 20));
    render(<CheckInPanel {...base} />);
    await locateWith(/GPS unavailable/);
    expect(await screen.findByText("We could not get your location", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText("Ask a marshal at the gate")).toBeInTheDocument();
  });

  it("after the start it warns that check-in counts as Late", async () => {
    freezeTime(lagosTime(2026, 11, 7, 9, 31));
    render(<CheckInPanel {...base} />);
    expect(await screen.findByText(/Checking in now counts as Late/)).toBeInTheDocument();
  });

  it("shows an existing check-in instead of the flow", async () => {
    freezeTime(lagosTime(2026, 11, 7, 9, 40));
    render(
      <CheckInPanel {...base} existing={{ status: "ON_TIME", checkedInAt: lagosTime(2026, 11, 7, 9, 18).toISO()! }} />,
    );
    expect(await screen.findByText("Already checked in")).toBeInTheDocument();
    expect(screen.getByText("On time · 9:18 am")).toBeInTheDocument();
  });

  it("Remote members are told no check-in is needed", async () => {
    freezeTime(lagosTime(2026, 11, 7, 9, 20));
    render(<CheckInPanel {...base} isRemote />);
    expect(await screen.findByText("No check-in needed")).toBeInTheDocument();
  });
});
