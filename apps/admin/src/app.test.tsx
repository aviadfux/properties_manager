// Screen tests: every page renders, and the main actions work end to end through the real
// router, layout and data layer.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "@/test/utils";

const PAGES = [
  "/",
  "/todo",
  "/customers",
  "/customers/c3",
  "/properties",
  "/properties/p16",
  "/properties/p1",
  "/tenants",
  "/tenants/t9",
  "/issues",
  "/issues/i8",
  "/professionals",
  "/professionals/pr6",
  "/payments",
  "/forms",
  "/forms/ft1",
  "/forms/mt2",
  "/forms/new",
];

describe("every page", () => {
  it.each(PAGES)("%s renders without errors", async (path) => {
    renderApp(path);
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["/", "/properties/p16", "/payments", "/forms/ft1"])("%s renders in Hebrew, right to left", async (path) => {
    renderApp(path, "he");
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
    expect(screen.getAllByRole("link", { name: "בעלי מקצוע" }).length).toBeGreaterThan(0);
  });

  it("shows a not-found page for unknown addresses", async () => {
    renderApp("/no-such-page");
    expect(await screen.findByText("Page not found")).toBeInTheDocument();
  });
});

describe("issues", () => {
  it("assigns a professional, best matches first, and records it in the history", async () => {
    const user = userEvent.setup();
    renderApp("/issues/i8");
    await user.click(await screen.findByRole("button", { name: "Choose a professional" }));
    const select = await screen.findByLabelText("Choose a professional");
    await waitFor(() => expect(within(select).getAllByRole("option").length).toBeGreaterThan(1));
    await user.selectOptions(select, "pr3");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Professional: קור-אוויר מיזוג")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "קור-אוויר מיזוג" })).toHaveAttribute("href", "/professionals/pr3");
  });
});

describe("properties", () => {
  it("opens a complex on its units, and shows its history", async () => {
    const user = userEvent.setup();
    renderApp("/properties/p16");
    expect(await screen.findByRole("link", { name: "המלאכה 8 / 201" })).toBeInTheDocument();
    expect(screen.getAllByText("4 of 5 units occupied").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("tab", { name: "History" }));
    expect(await screen.findByText("Repair costs")).toBeInTheDocument();
  });

  it("shows what a unit is part of", async () => {
    renderApp("/properties/p12");
    const breadcrumb = await screen.findByRole("navigation", { name: "Part of" });
    expect(within(breadcrumb).getByRole("link", { name: /קריית המלאכה/ })).toHaveAttribute("href", "/properties/p16");
  });
});

describe("forms", () => {
  it("generates a form from a lease and flags missing values", async () => {
    const user = userEvent.setup();
    renderApp("/forms/ft1");
    const record = await screen.findByLabelText("Lease");
    await waitFor(() => expect(within(record).getAllByRole("option").length).toBeGreaterThan(1));
    await user.selectOptions(record, "l12");
    expect(await screen.findByText(/Name: פיצה המלאכה/)).toBeInTheDocument();
    expect(screen.getByText(/No value for: .*Tenant email/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Print / PDF" })).toBeInTheDocument();
  });

  it("inserts a field at the cursor when it is clicked", async () => {
    const user = userEvent.setup();
    renderApp("/forms/new");
    const body = (await screen.findByLabelText(/Template text/)) as HTMLTextAreaElement;
    await user.click(screen.getByRole("button", { name: /Tenant name/ }));
    expect(body.value).toBe("{{tenant.name}}");
  });
});

describe("payment requests", () => {
  it("opens a pre-filled WhatsApp chat and then counts the message as sent", async () => {
    const user = userEvent.setup();
    renderApp("/payments");
    const send = await screen.findByRole("link", { name: /Send in WhatsApp/ });
    expect(send.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/972503456789\?text=Hello%20David%20Miller/);
    expect(screen.getByRole("button", { name: "1 WhatsApp message ready to send" })).toBeInTheDocument();
    send.addEventListener("click", (e) => e.preventDefault()); // jsdom cannot open a new tab
    await user.click(send);
    await waitFor(() => expect(screen.queryByRole("link", { name: /Send in WhatsApp/ })).not.toBeInTheDocument());
  });

  it("lets the manager turn a reminder rule off", async () => {
    const user = userEvent.setup();
    renderApp("/payments");
    await user.click(await screen.findByRole("tab", { name: "Reminder schedule" }));
    const rule = await screen.findByRole("checkbox", { name: "7 days after the due date" });
    await user.click(rule);
    await waitFor(() => expect(rule).not.toBeChecked());
  });
});

describe("search", () => {
  it("finds a professional and opens their card", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await user.type(await screen.findByRole("combobox", { name: "Search" }), "מעליות");
    await user.click(await screen.findByRole("option", { name: /מעליות המרכז/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "מעליות המרכז בע״מ" })).toBeInTheDocument();
  });
});
