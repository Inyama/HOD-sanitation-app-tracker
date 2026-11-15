import { describe, expect, it, vi } from "vitest";
import * as React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadMatchReview, type ReviewRow } from "@/components/admin/UploadMatchReview";
import { AudienceBuilder, type AudienceOption } from "@/components/admin/AudienceBuilder";
import type { AudienceSpec } from "@/lib/repo/types";

const row = (over: Partial<ReviewRow>): ReviewRow => ({
  id: "r",
  index: 0,
  name: "Ada Obi",
  email: "ada@example.com",
  time: null,
  matchType: "EMAIL",
  similarity: 1,
  matchedUserId: "u1",
  matchedName: "Ada Obi",
  warning: null,
  duplicateOf: null,
  resolution: null,
  ...over,
});

const rows: ReviewRow[] = [
  row({ id: "r1", index: 0 }),
  row({
    id: "r2",
    index: 1,
    name: "Adebayo Jonhson",
    email: null,
    matchType: "NAME_SUGGESTED",
    similarity: 0.93,
    matchedUserId: "u2",
    matchedName: "Adebayo Johnson",
  }),
  row({
    id: "r3",
    index: 2,
    name: "Stranger",
    email: "who@example.com",
    matchType: "NOT_FOUND",
    matchedUserId: null,
    matchedName: null,
    similarity: null,
  }),
  row({ id: "r4", index: 3, matchType: "DUPLICATE", duplicateOf: 0 }),
];
const people = [
  { id: "u1", name: "Ada Obi", email: "ada@example.com", status: "ACTIVE" },
  { id: "u2", name: "Adebayo Johnson", email: "member@hod-demo.example.com", status: "ACTIVE" },
];

describe("UploadMatchReview", () => {
  it("shows the four tabs with counts and opens on the suggestion that needs a decision", () => {
    render(<UploadMatchReview rows={rows} people={people} onResolve={() => {}} />);
    expect(screen.getByRole("tab", { name: /Matched 1/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Suggested 1 \(1 to decide\)/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Not found 1/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Duplicates 1/ })).toBeInTheDocument();
    expect(screen.getByText("Adebayo Johnson", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText(/93% similar name/)).toBeInTheDocument();
  });

  it("confirming a suggestion and assigning an unknown row call back with the decision", async () => {
    const onResolve = vi.fn();
    const user = userEvent.setup();
    render(<UploadMatchReview rows={rows} people={people} onResolve={onResolve} />);
    await user.click(screen.getByRole("button", { name: "Confirm Adebayo Jonhson is Adebayo Johnson" }));
    expect(onResolve).toHaveBeenLastCalledWith(rows[1], { kind: "ACCEPT" });
    await user.click(screen.getByRole("tab", { name: /Not found/ }));
    const list = screen.getByRole("list", { name: "Not found rows" });
    await user.selectOptions(within(list).getByLabelText("Assign row 4 to a person"), "u1");
    await user.click(within(list).getByRole("button", { name: /Assign/ }));
    expect(onResolve).toHaveBeenLastCalledWith(rows[2], { kind: "ASSIGN", userId: "u1" });
  });

  it("duplicates explain that they are counted once and cannot be changed", async () => {
    const user = userEvent.setup();
    render(<UploadMatchReview rows={rows} people={people} onResolve={() => {}} />);
    await user.click(screen.getByRole("tab", { name: /Duplicates/ }));
    const list = screen.getByRole("list", { name: "Duplicates rows" });
    expect(within(list).getByText("Repeats row 2; counted once")).toBeInTheDocument();
    expect(within(list).queryByRole("button")).toBeNull();
  });
});

const audience: AudienceOption[] = [
  {
    id: "1",
    name: "Ada Obi",
    role: "MEMBER",
    status: "ACTIVE",
    teamIds: ["t1"],
    band: "amber",
    bandLabel: "Needs attention",
    percent: 60,
    absentLastSaturday: true,
  },
  {
    id: "2",
    name: "Ben Eze",
    role: "VOLUNTEER",
    status: "ACTIVE",
    teamIds: ["t1"],
    band: "gold",
    bandLabel: "Gold standard",
    percent: 95,
    absentLastSaturday: false,
  },
  {
    id: "3",
    name: "Cy Lawal",
    role: "MEMBER",
    status: "ACTIVE",
    teamIds: [],
    band: "amber",
    bandLabel: "Needs attention",
    percent: 55,
    absentLastSaturday: false,
  },
];

function Harness() {
  const [spec, setSpec] = React.useState<AudienceSpec>({ kind: "EVERYONE" });
  return <AudienceBuilder people={audience} teams={[{ id: "t1", name: "Kitchen" }]} value={spec} onChange={setSpec} />;
}

describe("AudienceBuilder", () => {
  it("counts exactly the people the audience reaches", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const count = () => screen.getByTestId("audience-count").textContent;
    expect(count()).toMatch(/^3 people/);
    await user.click(screen.getByRole("radio", { name: "All volunteers" }));
    expect(count()).toMatch(/^1 person will receive this: Ben Eze/);
    await user.click(screen.getByRole("radio", { name: "A percentage band" }));
    expect(count()).toMatch(/^2 people/);
    await user.click(screen.getByRole("radio", { name: "Absent last Saturday" }));
    expect(count()).toMatch(/^1 person will receive this: Ada Obi/);
    await user.click(screen.getByRole("radio", { name: "Hand-picked" }));
    expect(count()).toMatch(/^0 people/);
    await user.click(screen.getByRole("checkbox", { name: /Cy Lawal/ }));
    expect(count()).toMatch(/^1 person will receive this: Cy Lawal/);
  });
});
