// Screen tests: every page renders, and the main actions work end to end through the real
// router, layout and data layer.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { writeDocx } from "@/data/docx";
import { toBlocks } from "@/data/templates";
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
  "/agreements",
  "/agreements/ag3",
  "/agreements/import",
  "/agreements/new?customer=c5",
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

  it.each(["/", "/properties/p16", "/payments", "/forms/ft1", "/agreements/import", "/agreements/ag1"])("%s renders in Hebrew, right to left", async (path) => {
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

// Screen tests share one copy of the sample data, so these do not depend on what earlier tests created.
describe("agreements", () => {
  const document = `# הסכם ניהול נכסים
## הבעלים
שם: משה לוי
ת.ז.: 207654328
טלפון: 054-765-4321
דוא״ל: moshe@example.com
## הנכסים המנוהלים
- כצנלסון 8 / 3, גבעתיים
- רחוב שלא קיים 1, אילת
## תנאי ההסכם
תקופת ההסכם: 01/12/2026 – 30/11/2027
דמי ניהול: 6% משכר הדירה`;

  it("creates a customer from a pasted agreement, after the manager checks the details", async () => {
    const user = userEvent.setup();
    renderApp("/agreements/import");
    await user.click(await screen.findByLabelText("or paste the agreement's text"));
    await user.paste(document);
    await user.click(screen.getByRole("button", { name: "Read the details" }));

    expect(await screen.findByLabelText("Name")).toHaveValue("משה לוי");
    expect(screen.getByLabelText("Phone")).toHaveValue("054-765-4321");
    expect(screen.getByLabelText("Start")).toHaveValue("2026-12-01");
    expect(screen.getByLabelText("Percentage of rent")).toHaveValue(6);
    expect(await screen.findByText("Not in the system – add the property and link it to the agreement")).toBeInTheDocument();
    // The privacy check shows the text without the personal details.
    const redacted = screen.getByText(/\[NAME_1\]/);
    expect(redacted.textContent).not.toMatch(/משה לוי|207654328|054-765-4321|moshe@/);

    await user.click(screen.getByRole("button", { name: "Create customer and agreement" }));
    expect(await screen.findByText("Agreement saved.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "משה לוי" })).toHaveAttribute("href", expect.stringMatching(/^\/customers\/c\d+-/));
    expect(screen.getByRole("link", { name: "כצנלסון 8 / 3, גבעתיים" })).toBeInTheDocument();
  });

  it("reads a Word file and offers the existing customer instead of a duplicate", async () => {
    const user = userEvent.setup();
    renderApp("/agreements/import");
    const text = document.replace("207654328", "034827139"); // the ID of an existing customer
    const file = new File([writeDocx(toBlocks(text), { rtl: true })], "agreement.docx");
    await user.upload(await screen.findByLabelText("Agreement file (Word or text)"), file);

    expect(await screen.findByText("This customer may already exist")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Add the agreement to יוסי כהן/ })).toBeChecked();
    expect(screen.getByText("Read from: agreement.docx")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save the agreement to the existing customer" }));
    expect(await screen.findByRole("link", { name: "יוסי כהן" })).toHaveAttribute("href", "/customers/c1");
  });

  it("refuses files it cannot read safely", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderApp("/agreements/import");
    const input = await screen.findByLabelText("Agreement file (Word or text)");
    await user.upload(input, new File(["%PDF-1.7"], "agreement.pdf"));
    expect(await screen.findByRole("alert")).toHaveTextContent("PDF files are not supported yet.");
    // An old Word file, even when renamed to .docx, is recognized by its content.
    await user.upload(input, new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0])], "agreement.docx"));
    expect(await screen.findByRole("alert")).toHaveTextContent("save it as .docx");
    await user.upload(input, new File(["   \n\n  "], "agreement.txt"));
    expect(await screen.findByRole("alert")).toHaveTextContent("No text was found in the file.");
  });

  it("creates an agreement from a customer's details and exports it", async () => {
    const user = userEvent.setup();
    renderApp("/customers/c5");
    await user.click(await screen.findByRole("tab", { name: /Agreements/ }));
    await user.click(await screen.findByRole("link", { name: "Create agreement" }));
    await user.type(await screen.findByLabelText("Percentage of rent"), "5");
    await user.click(screen.getByRole("button", { name: "Create agreement" }));

    expect(await screen.findByRole("heading", { level: 1, name: /^Management agreements #\d+$/ })).toBeInTheDocument();
    expect(screen.getByText("Draft – not signed")).toBeInTheDocument();
    expect(await screen.findByText("שם: רונית שפירא")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download as Word" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mark as signed" }));
    expect(await screen.findByText("In force")).toBeInTheDocument();
  });
});

describe("sensitive details", () => {
  it("shows ID numbers masked until asked", async () => {
    const user = userEvent.setup();
    renderApp("/customers/c3");
    await user.click(await screen.findByRole("tab", { name: "Details" }));
    expect(screen.getByText("•••••3453")).toBeInTheDocument();
    expect(screen.queryByText("515123453")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByText("515123453")).toBeInTheDocument();
  });
});

describe("checks", () => {
  it("blocks saving an import with an invalid phone number, and explains why", async () => {
    const user = userEvent.setup();
    renderApp("/agreements/import");
    await user.click(await screen.findByLabelText("or paste the agreement's text"));
    await user.paste("## The owner\nName: Noa Bar\nPhone: 050-12\n## Terms\nTerm: 01/12/2026 – 30/11/2027\nManagement fee: 6%");
    await user.click(screen.getByRole("button", { name: "Read the details" }));

    // "050-12" is not a phone number, so none was read from the document.
    expect(await screen.findByText("The phone number is missing.")).toBeInTheDocument();
    expect(screen.getByText("Fix the errors before saving.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create customer and agreement" })).toBeDisabled();

    await user.type(screen.getByLabelText("Phone"), "050-12");
    expect(await screen.findByText(/The phone number is not valid/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Phone"));
    await user.type(screen.getByLabelText("Phone"), "050-123-4567");
    await waitFor(() => expect(screen.getByRole("button", { name: "Create customer and agreement" })).toBeEnabled());
    expect(screen.getByText("The agreement has no properties.")).toBeInTheDocument(); // a warning: saving is allowed
  });

  it("confirms that an exported agreement states exactly what the record says", async () => {
    renderApp("/agreements/ag1");
    expect(await screen.findByText(/Checked: the document states every detail/)).toBeInTheDocument();
  });

  it("makes a power of attorney and a quote from the same agreement", async () => {
    const user = userEvent.setup();
    renderApp("/agreements/ag1");
    expect(await screen.findByText(/Checked: the document states every detail/)).toBeInTheDocument();
    await user.selectOptions(await screen.findByLabelText("Template"), "ft3");
    expect(await screen.findByText(/הידוע כגוש 6123 חלקה 45/)).toBeInTheDocument();
    expect(screen.getByText("- יוסי כהן, ת.ז. / ח.פ. 034827139".slice(2))).toBeInTheDocument();
    // Only the agreement itself is checked against the record.
    expect(screen.queryByText(/Checked: the document states every detail/)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Template"), "ft4");
    expect(await screen.findByText(/הצעת מחיר לשירותי ניהול/, { selector: "h2" })).toBeInTheDocument();
  });

  it("warns when an agreement template leaves out details", async () => {
    const user = userEvent.setup();
    renderApp("/forms/ft2");
    const body = await screen.findByLabelText(/Template text/);
    await user.clear(body);
    await user.type(body, "Name: {{{{customer.name}}");
    expect(screen.getByText(/The template lacks fields/)).toHaveTextContent("ID / company no.");
  });
});
