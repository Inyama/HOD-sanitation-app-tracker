import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { resetClock } from "@/lib/time/clock";

afterEach(() => {
  cleanup();
  resetClock();
});
