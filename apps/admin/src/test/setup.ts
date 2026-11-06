// Runs before every test file.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { TODAY } from "./utils";

// Sample data is dated relative to "today", so tests freeze the clock (Date only; timers stay real).
vi.useFakeTimers({ toFake: ["Date"], now: new Date(`${TODAY}T09:00:00Z`) });

afterEach(() => {
  cleanup();
  localStorage.clear();
});
