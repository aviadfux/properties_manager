// Realistic sample data for the screens-first phase (build plan, Phase 0b).
// Dates are relative to today so lists like "leases ending soon" always have content.
import type {
  CollectionsSummary,
  Customer,
  DebtAging,
  Issue,
  IssueEvent,
  Lease,
  Ownership,
  PaymentToVerify,
  Property,
  Tenant,
  User,
} from "@/domain/types";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const date = (days: number) => new Date(now + days * DAY).toISOString().slice(0, 10);
const at = (days: number, hour = 10) => {
  const d = new Date(now + days * DAY);
  d.setUTCHours(hour - 3, 0, 0, 0); // Israel time ≈ UTC+3 in sample data
  return d.toISOString();
};

export const users: User[] = [
  { id: "u1", name: "מנהל ראשי", email: "manager@example.com", role: "managing_director", active: true },
  { id: "u2", name: "דנה לוי", email: "dana@example.com", role: "property_manager", active: true },
];

export const customers: Customer[] = [
  { id: "c1", number: 101, kind: "individual", name: "יוסי כהן", phone: "+972521234567", email: "yossi@example.com", preferredLanguage: "he", preferredChannel: "whatsapp", status: "active" },
  { id: "c2", number: 102, kind: "individual", name: "מירב אברהם", phone: "+972542345678", email: "merav@example.com", preferredLanguage: "he", preferredChannel: "email", status: "active" },
  { id: "c3", number: 103, kind: "company", name: "גלבוע השקעות בע״מ", taxId: "515123456", phone: "+97236123456", email: "office@gilboa.example.com", billingAddress: "דרך מנחם בגין 132, תל אביב", preferredLanguage: "he", preferredChannel: "email", status: "active" },
  { id: "c4", number: 104, kind: "individual", name: "David Miller", phone: "+972503456789", email: "david@example.com", preferredLanguage: "en", preferredChannel: "whatsapp", status: "active", notes: "Lives abroad — prefers English and WhatsApp." },
  { id: "c5", number: 105, kind: "individual", name: "רונית שפירא", phone: "+972524567890", preferredLanguage: "he", preferredChannel: "phone", status: "active" },
  { id: "c6", number: 106, kind: "individual", name: "אבי ורחל פרץ", phone: "+972585678901", email: "peretz@example.com", preferredLanguage: "he", preferredChannel: "whatsapp", status: "active" },
];

export const properties: Property[] = [
  { id: "p1", number: 1, kind: "apartment", address: "הרצל 12", city: "רמת גן", unit: "5", floor: 2, areaSqm: 78, rooms: 3.5 },
  { id: "p2", number: 2, kind: "apartment", address: "בן יהודה 40", city: "תל אביב", unit: "12", floor: 4, areaSqm: 64, rooms: 2.5 },
  { id: "p3", number: 3, kind: "office", address: "דרך מנחם בגין 132", city: "תל אביב", unit: "1804", floor: 18, areaSqm: 140 },
  { id: "p4", number: 4, kind: "shop", address: "סוקולוב 55", city: "הרצליה", areaSqm: 52 },
  { id: "p5", number: 5, kind: "apartment", address: "כצנלסון 8", city: "גבעתיים", unit: "3", floor: 1, areaSqm: 95, rooms: 4 },
  { id: "p6", number: 6, kind: "apartment", address: "ז׳בוטינסקי 101", city: "פתח תקווה", unit: "22", floor: 7, areaSqm: 110, rooms: 5 },
  { id: "p7", number: 7, kind: "apartment", address: "סוקולוב 20", city: "חולון", unit: "9", floor: 3, areaSqm: 70, rooms: 3 },
  { id: "p8", number: 8, kind: "commercial", address: "המלאכה 6", city: "ראש העין", areaSqm: 320, notes: "מחסן ומשרדים" },
  { id: "p9", number: 9, kind: "apartment", address: "ביאליק 17", city: "רמת גן", unit: "2", floor: 0, areaSqm: 58, rooms: 2 },
  { id: "p10", number: 10, kind: "apartment", address: "ויצמן 31", city: "כפר סבא", unit: "14", floor: 5, areaSqm: 102, rooms: 4.5 },
];

export const ownerships: Ownership[] = [
  { id: "o1", customerId: "c1", propertyId: "p1", sharePercent: 100, startDate: "2019-03-01" },
  { id: "o2", customerId: "c1", propertyId: "p9", sharePercent: 100, startDate: "2021-06-15" },
  { id: "o3", customerId: "c2", propertyId: "p2", sharePercent: 100, startDate: "2018-01-10" },
  { id: "o4", customerId: "c3", propertyId: "p3", sharePercent: 100, startDate: "2020-09-01" },
  { id: "o5", customerId: "c3", propertyId: "p8", sharePercent: 100, startDate: "2022-02-01" },
  { id: "o6", customerId: "c4", propertyId: "p4", sharePercent: 100, startDate: "2017-05-20" },
  { id: "o7", customerId: "c4", propertyId: "p10", sharePercent: 100, startDate: "2023-11-01" },
  { id: "o8", customerId: "c5", propertyId: "p5", sharePercent: 100, startDate: "2016-08-01" },
  { id: "o9", customerId: "c6", propertyId: "p6", sharePercent: 50, startDate: "2020-04-01" },
  { id: "o10", customerId: "c5", propertyId: "p6", sharePercent: 50, startDate: "2020-04-01" },
  { id: "o11", customerId: "c6", propertyId: "p7", sharePercent: 100, startDate: "2015-12-01" },
  // Sold in the past: p7 previously belonged to c2 — kept as history.
  { id: "o12", customerId: "c2", propertyId: "p7", sharePercent: 100, startDate: "2010-01-01", endDate: "2015-11-30" },
];

export const tenants: Tenant[] = [
  { id: "t1", number: 501, kind: "individual", name: "נועה ברק", phone: "+972521112233", email: "noa@example.com", preferredLanguage: "he" },
  { id: "t2", number: 502, kind: "individual", name: "עומר גולן", phone: "+972542223344", preferredLanguage: "he" },
  { id: "t3", number: 503, kind: "company", name: "טקנובה בע״מ", taxId: "514998877", phone: "+97237778899", email: "admin@technova.example.com", preferredLanguage: "he" },
  { id: "t4", number: 504, kind: "company", name: "קפה סוקולוב", phone: "+972549990011", preferredLanguage: "he" },
  { id: "t5", number: 505, kind: "individual", name: "Sarah Cohen", phone: "+972503334455", email: "sarah@example.com", preferredLanguage: "en" },
  { id: "t6", number: 506, kind: "individual", name: "יעל ומשה דהן", phone: "+972525556677", preferredLanguage: "he" },
  { id: "t7", number: 507, kind: "individual", name: "איתן רוזן", phone: "+972586667788", preferredLanguage: "he" },
  { id: "t8", number: 508, kind: "company", name: "לוגיסטיקה מרכז בע״מ", phone: "+97239001122", preferredLanguage: "he" },
];

export const leases: Lease[] = [
  { id: "l1", propertyId: "p1", tenantId: "t1", startDate: date(-335), endDate: date(30), monthlyRentMinor: 650000, currency: "ILS" },
  { id: "l2", propertyId: "p2", tenantId: "t2", startDate: date(-700), endDate: date(395), monthlyRentMinor: 620000, currency: "ILS" },
  { id: "l3", propertyId: "p3", tenantId: "t3", startDate: date(-900), endDate: date(560), monthlyRentMinor: 1850000, currency: "ILS" },
  { id: "l4", propertyId: "p4", tenantId: "t4", startDate: date(-1400), endDate: date(52), monthlyRentMinor: 1100000, currency: "ILS" },
  { id: "l5", propertyId: "p5", tenantId: "t5", startDate: date(-200), endDate: date(165), monthlyRentMinor: 780000, currency: "ILS" },
  { id: "l6", propertyId: "p6", tenantId: "t6", startDate: date(-100), endDate: date(630), monthlyRentMinor: 820000, currency: "ILS" },
  { id: "l7", propertyId: "p7", tenantId: "t7", startDate: date(-500), endDate: date(-10), monthlyRentMinor: 560000, currency: "ILS" },
  { id: "l8", propertyId: "p8", tenantId: "t8", startDate: date(-60), endDate: date(1035), monthlyRentMinor: 2400000, currency: "ILS" },
  { id: "l9", propertyId: "p10", tenantId: "t5", startDate: date(-30), endDate: date(335), monthlyRentMinor: 900000, currency: "ILS" },
  // p9 is vacant; p7's lease ended 10 days ago.
];

export const issues: Issue[] = [
  { id: "i1", number: 1042, propertyId: "p1", customerId: "c1", reporter: { type: "tenant", id: "t1" }, assigneeId: "u1", title: "נזילה מתחת לכיור במטבח", description: "מים מצטברים בארון מתחת לכיור, הרצפה רטובה.", category: "plumbing", location: "מטבח", urgency: "emergency", status: "new", openedAt: at(0, 8) },
  { id: "i2", number: 1041, propertyId: "p3", customerId: "c3", reporter: { type: "tenant", id: "t3" }, assigneeId: "u2", title: "מזגן בחדר הישיבות לא מקרר", description: "המזגן פועל אך מוציא אוויר חם.", category: "hvac", location: "חדר ישיבות", urgency: "high", status: "awaiting_approval", openedAt: at(-3, 11) },
  { id: "i3", number: 1040, propertyId: "p4", customerId: "c4", reporter: { type: "tenant", id: "t4" }, assigneeId: "u1", title: "תריס חשמלי תקוע", description: "התריס בחזית החנות לא נפתח עד הסוף.", category: "electrical", location: "חזית", urgency: "normal", status: "awaiting_approval", openedAt: at(-5, 9) },
  { id: "i4", number: 1039, propertyId: "p5", customerId: "c5", reporter: { type: "tenant", id: "t5" }, assigneeId: "u2", title: "Boiler not heating", description: "No hot water since yesterday evening.", category: "plumbing", location: "Bathroom", urgency: "high", status: "scheduled", openedAt: at(-2, 19) },
  { id: "i5", number: 1038, propertyId: "p2", customerId: "c2", reporter: { type: "tenant", id: "t2" }, assigneeId: "u1", title: "דלת הכניסה לא ננעלת", description: "המנעול מסתובב בלי לנעול.", category: "locks", location: "כניסה", urgency: "high", status: "in_progress", openedAt: at(-1, 14) },
  { id: "i6", number: 1037, propertyId: "p6", customerId: "c6", reporter: { type: "tenant", id: "t6" }, assigneeId: "u2", title: "רטיבות בקיר חדר השינה", description: "כתם רטיבות מתרחב ליד החלון.", category: "structural", location: "חדר שינה", urgency: "normal", status: "awaiting_quote", openedAt: at(-8, 10) },
  { id: "i7", number: 1036, propertyId: "p8", customerId: "c3", reporter: { type: "tenant", id: "t8" }, title: "תאורה במחסן מהבהבת", description: "שלוש מנורות במחסן מהבהבות.", category: "electrical", location: "מחסן", urgency: "low", status: "under_review", openedAt: at(-4, 13) },
  { id: "i8", number: 1035, propertyId: "p10", customerId: "c4", reporter: { type: "tenant", id: "t5" }, assigneeId: "u1", title: "Dishwasher leaking", description: "Small puddle after each cycle.", category: "appliances", location: "Kitchen", urgency: "normal", status: "awaiting_signoff", openedAt: at(-12, 16) },
  { id: "i9", number: 1034, propertyId: "p7", customerId: "c6", reporter: { type: "customer", id: "c6" }, assigneeId: "u1", title: "צביעה והכנה לשוכר הבא", description: "הדירה התפנתה, נדרשת צביעה וניקיון.", category: "cleaning", urgency: "normal", status: "approved", openedAt: at(-9, 9) },
  { id: "i10", number: 1033, propertyId: "p1", customerId: "c1", reporter: { type: "tenant", id: "t1" }, assigneeId: "u1", title: "החלפת ברז באמבטיה", description: "הברז מטפטף.", category: "plumbing", location: "אמבטיה", urgency: "low", status: "closed", openedAt: at(-40, 10), closedAt: at(-35, 15), resolution: "הוחלף ברז.", actualCostMinor: 45000 },
  { id: "i11", number: 1032, propertyId: "p3", customerId: "c3", reporter: { type: "user", id: "u2" }, assigneeId: "u2", title: "בדיקה תקופתית למערכת כיבוי", description: "בדיקה שנתית.", category: "other", urgency: "normal", status: "closed", openedAt: at(-60, 10), closedAt: at(-55, 12), resolution: "בוצעה בדיקה, תקין.", actualCostMinor: 0 },
  { id: "i12", number: 1031, propertyId: "p9", customerId: "c1", reporter: { type: "customer", id: "c1" }, assigneeId: "u1", title: "הדברה לפני השכרה", description: "", category: "pests", urgency: "low", status: "cancelled", openedAt: at(-20, 10), closedAt: at(-18, 10), resolution: "בוטל על ידי הלקוח." },
  { id: "i13", number: 1043, propertyId: "p6", customerId: "c6", reporter: { type: "tenant", id: "t6" }, title: "מעלית תקועה בקומה 7", description: "המעלית לא מגיעה לקומה 7 מהבוקר.", category: "elevator", urgency: "high", status: "new", openedAt: at(0, 9) },
];

export const issueEvents: IssueEvent[] = [
  { id: "e1", issueId: "i2", kind: "status", actor: { type: "user", id: "u2" }, fromStatus: "new", toStatus: "under_review", internal: false, at: at(-3, 12) },
  { id: "e2", issueId: "i2", kind: "note", actor: { type: "user", id: "u2" }, body: "טכנאי בדק – נדרשת החלפת מדחס. התקבלה הצעת מחיר 3,200 ₪.", internal: true, at: at(-2, 10) },
  { id: "e3", issueId: "i2", kind: "status", actor: { type: "user", id: "u2" }, fromStatus: "awaiting_quote", toStatus: "awaiting_approval", internal: false, at: at(-2, 10) },
  { id: "e4", issueId: "i4", kind: "status", actor: { type: "user", id: "u2" }, fromStatus: "approved", toStatus: "scheduled", body: "Technician scheduled for tomorrow 9:00.", internal: false, at: at(-1, 9) },
  { id: "e5", issueId: "i5", kind: "assignment", actor: { type: "user", id: "u1" }, body: "שויך למנהל ראשי", internal: true, at: at(-1, 15) },
  { id: "e6", issueId: "i1", kind: "note", actor: { type: "tenant", id: "t1" }, body: "צירפתי תמונה של הארון.", internal: false, at: at(0, 8) },
];

// --- Billing figures: sample only until Phase 2 ---

export const collections: CollectionsSummary = {
  month: date(0).slice(0, 8) + "01",
  dueMinor: 3100000,
  verifiedMinor: 2232000,
  unverifiedMinor: 450000,
  updatedAt: at(0, 7),
};

export const debtAging: DebtAging = [
  { bucket: "0-30", amountMinor: 520000, customers: 3 },
  { bucket: "31-60", amountMinor: 210000, customers: 1 },
  { bucket: "61-90", amountMinor: 110000, customers: 1 },
  { bucket: "90+", amountMinor: 0, customers: 0 },
];

export const paymentsToVerify: PaymentToVerify[] = [
  { id: "pv1", customerId: "c2", amountMinor: 450000, reportedAt: at(-1, 18), method: "bank_transfer" },
];
