import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CountdownTiles } from "@/components/brand/CountdownHero";
import { freezeTime } from "@/lib/time/clock";
import { lagosTime } from "@/lib/time/zone";

const saturday = lagosTime(2026, 11, 7, 9, 30).toISO()!;

describe("countdown matches the meeting time shown", () => {
  it("counts from the real clock to the displayed start", async () => {
    freezeTime(lagosTime(2026, 11, 7, 8, 0)); // Saturday 7 November, 8:00 am Lagos
    render(<CountdownTiles startsAt={saturday} />);
    expect(await screen.findByText("Starts in 1 hour and 30 minutes.")).toBeInTheDocument();
  });

  it("is the same instant for a viewer in London (an hour behind Lagos in November)", async () => {
    freezeTime("2026-11-07T07:00:00Z"); // 7:00 am London = 8:00 am Lagos
    render(<CountdownTiles startsAt={saturday} />);
    expect(await screen.findByText("Starts in 1 hour and 30 minutes.")).toBeInTheDocument();
  });

  it("shows several days when the meeting is further away", async () => {
    freezeTime(lagosTime(2026, 11, 4, 9, 30)); // Wednesday
    render(<CountdownTiles startsAt={saturday} />);
    expect(await screen.findByText("Starts in 3 days, 0 hours and 0 minutes.")).toBeInTheDocument();
  });

  it("says it is happening once the start time has passed", async () => {
    freezeTime(lagosTime(2026, 11, 7, 9, 45));
    render(<CountdownTiles startsAt={saturday} />);
    expect(await screen.findByText("Happening now")).toBeInTheDocument();
  });
});
