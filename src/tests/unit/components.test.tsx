import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AttendanceRing } from "@/components/charts/AttendanceRing";
import { StatusChip } from "@/components/attendance/StatusChip";

describe("AttendanceRing", () => {
  const cases: [number | null, string, string][] = [
    [95, "gold", "Gold standard"],
    [90, "gold", "Gold standard"],
    [89.9, "green", "Strong"],
    [75, "green", "Strong"],
    [74.9, "amber", "Needs attention"],
    [50, "amber", "Needs attention"],
    [49.9, "red", "At risk"],
    [null, "none", "No meetings yet"],
  ];

  it.each(cases)("%s percent is the %s band and prints its name", (pct, key, label) => {
    const { container } = render(<AttendanceRing percent={pct} label="Overall" />);
    const figure = container.querySelector("figure")!;
    expect(figure.dataset.band).toBe(key);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(figure).toHaveAccessibleName(new RegExp(label));
  });

  it("shows the percentage with one decimal and drops a trailing .0", () => {
    render(<AttendanceRing percent={89.5} />);
    expect(screen.getByText("89.5%")).toBeInTheDocument();
    render(<AttendanceRing percent={90} />);
    expect(screen.getByText("90%")).toBeInTheDocument();
  });
});

describe("StatusChip", () => {
  it.each([
    ["ON_TIME", "On time"],
    ["LATE", "Late"],
    ["ABSENT", "Absent"],
    ["EXCUSED", "Excused"],
    ["MANUAL", "Manual"],
    ["FLAGGED", "Flagged"],
  ] as const)("%s renders an icon and the word %s", (status, text) => {
    const { container } = render(<StatusChip status={status} />);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("accepts a custom label", () => {
    render(<StatusChip status="LATE" label="Late · 9:42 am" />);
    expect(screen.getByText("Late · 9:42 am")).toBeInTheDocument();
  });
});
