// Realistic sample data for the screens-first phase (build plan, Phase 0b).
// Dates are relative to today so lists like "leases ending soon" always have content.
import type {
  CollectionsSummary,
  Customer,
  DebtAging,
  Issue,
  IssueEvent,
  FormTemplate,
  Lease,
  OutgoingMessage,
  Ownership,
  PaymentRequest,
  PaymentToVerify,
  Professional,
  Property,
  ReminderRule,
  ServiceArea,
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

// Organization settings used by forms and messages (the real values come from the organization's settings).
export const organization = {
  name: "עוגן ניהול נכסים",
  phone: "+97235550100",
  email: "office@example.com",
  address: "רחוב הדוגמה 1, תל אביב",
  bankDetails: "בנק 12, סניף 345, חשבון 678901",
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

// A complex with a building and units inside it: p16 (complex) ⊃ p8 (warehouse) + p11 (building) ⊃ p12–p15.

export const properties: Property[] = [
  { id: "p1", number: 1, kind: "apartment", address: "הרצל 12", city: "רמת גן", unit: "5", floor: 2, areaSqm: 78, rooms: 3.5 },
  { id: "p2", number: 2, kind: "apartment", address: "בן יהודה 40", city: "תל אביב", unit: "12", floor: 4, areaSqm: 64, rooms: 2.5 },
  { id: "p3", number: 3, kind: "office", address: "דרך מנחם בגין 132", city: "תל אביב", unit: "1804", floor: 18, areaSqm: 140 },
  { id: "p4", number: 4, kind: "shop", address: "סוקולוב 55", city: "הרצליה", areaSqm: 52 },
  { id: "p5", number: 5, kind: "apartment", address: "כצנלסון 8", city: "גבעתיים", unit: "3", floor: 1, areaSqm: 95, rooms: 4 },
  { id: "p6", number: 6, kind: "apartment", address: "ז׳בוטינסקי 101", city: "פתח תקווה", unit: "22", floor: 7, areaSqm: 110, rooms: 5 },
  { id: "p7", number: 7, kind: "apartment", address: "סוקולוב 20", city: "חולון", unit: "9", floor: 3, areaSqm: 70, rooms: 3 },
  { id: "p8", number: 8, kind: "commercial", parentId: "p16", address: "המלאכה 6", city: "ראש העין", areaSqm: 320, notes: "מחסן ומשרדים" },
  { id: "p9", number: 9, kind: "apartment", address: "ביאליק 17", city: "רמת גן", unit: "2", floor: 0, areaSqm: 58, rooms: 2 },
  { id: "p10", number: 10, kind: "apartment", address: "ויצמן 31", city: "כפר סבא", unit: "14", floor: 5, areaSqm: 102, rooms: 4.5 },
  { id: "p16", number: 16, kind: "complex", address: "קריית המלאכה", city: "ראש העין", areaSqm: 2400, notes: "מתחם מסחרי: מבנה משרדים ומחסן" },
  { id: "p11", number: 11, kind: "building", parentId: "p16", address: "המלאכה 8", city: "ראש העין", areaSqm: 900, notes: "מבנה משרדים, 3 קומות, מעלית" },
  { id: "p12", number: 12, kind: "office", parentId: "p11", address: "המלאכה 8", city: "ראש העין", unit: "201", floor: 2, areaSqm: 180 },
  { id: "p13", number: 13, kind: "office", parentId: "p11", address: "המלאכה 8", city: "ראש העין", unit: "301", floor: 3, areaSqm: 180 },
  { id: "p14", number: 14, kind: "shop", parentId: "p11", address: "המלאכה 8", city: "ראש העין", unit: "1", floor: 0, areaSqm: 95 },
  { id: "p15", number: 15, kind: "parking", parentId: "p11", address: "המלאכה 8", city: "ראש העין", unit: "P-12", floor: -1 },
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
  // The complex is owned as a whole; the building and its units inherit the owner (no rows of their own).
  { id: "o13", customerId: "c3", propertyId: "p16", sharePercent: 100, startDate: "2022-02-01" },
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
  { id: "t9", number: 509, kind: "company", name: "סטודיו נגה עיצוב", phone: "+972527771234", email: "studio@example.com", preferredLanguage: "he" },
  { id: "t10", number: 510, kind: "company", name: "פיצה המלאכה", phone: "+972548882345", preferredLanguage: "he" },
  { id: "t11", number: 511, kind: "individual", name: "אורי שלום", phone: "+972529993456", preferredLanguage: "he", notes: "שוכר קודם בהרצל 12" },
  { id: "t12", number: 512, kind: "individual", name: "Daniel Levi", phone: "+972501114567", email: "daniel@example.com", preferredLanguage: "en" },
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
  { id: "l10", propertyId: "p12", tenantId: "t9", startDate: date(-420), endDate: date(310), monthlyRentMinor: 1350000, currency: "ILS" },
  { id: "l11", propertyId: "p15", tenantId: "t9", startDate: date(-420), endDate: date(310), monthlyRentMinor: 50000, currency: "ILS" },
  { id: "l12", propertyId: "p14", tenantId: "t10", startDate: date(-150), endDate: date(945), monthlyRentMinor: 900000, currency: "ILS" },
  // Earlier tenants, kept as history.
  { id: "l13", propertyId: "p1", tenantId: "t11", startDate: date(-1100), endDate: date(-336), monthlyRentMinor: 590000, currency: "ILS" },
  { id: "l14", propertyId: "p2", tenantId: "t12", startDate: date(-1430), endDate: date(-701), monthlyRentMinor: 560000, currency: "ILS" },
  { id: "l15", propertyId: "p13", tenantId: "t3", startDate: date(-1000), endDate: date(-90), monthlyRentMinor: 1250000, currency: "ILS" },
  // p9 and p13 are vacant; p7's lease ended 10 days ago.
];

export const serviceAreas: ServiceArea[] = [
  { id: "a1", name: "גוש דן", cities: ["תל אביב", "רמת גן", "גבעתיים", "חולון", "בת ים", "בני ברק"] },
  { id: "a2", name: "השרון", cities: ["הרצליה", "כפר סבא", "רעננה", "הוד השרון"] },
  { id: "a3", name: "מזרח המרכז", cities: ["פתח תקווה", "ראש העין", "אלעד"] },
];

export const professionals: Professional[] = [
  { id: "pr1", number: 301, kind: "company", name: "אינסטלציה ש.ב.", contactName: "שמעון ברגר", phone: "+972521230001", email: "sb@example.com", trades: ["plumbing"], serviceAreaIds: ["a1"], extraCities: [], rating: 5, active: true },
  { id: "pr2", number: 302, kind: "individual", name: "אורן החשמלאי", phone: "+972521230002", trades: ["electrical"], serviceAreaIds: ["a3", "a2"], extraCities: ["תל אביב"], rating: 4, active: true },
  { id: "pr3", number: 303, kind: "company", name: "קור-אוויר מיזוג", contactName: "ליאור", phone: "+97235550003", email: "service@korair.example.com", trades: ["hvac", "appliances"], serviceAreaIds: [], extraCities: ["תל אביב", "רמת גן", "גבעתיים"], rating: 4, active: true },
  { id: "pr4", number: 304, kind: "company", name: "מעליות המרכז בע״מ", phone: "+97239990004", email: "calls@elevators.example.com", trades: ["elevator"], serviceAreaIds: ["a1", "a3"], extraCities: ["הרצליה"], rating: 3, active: true, notes: "חוזה שירות שנתי למעלית בהמלאכה 8" },
  { id: "pr5", number: 305, kind: "individual", name: "אבי המנעולן", phone: "+972521230005", trades: ["locks"], serviceAreaIds: ["a1"], extraCities: ["פתח תקווה"], rating: 5, active: true, notes: "זמין 24/7" },
  { id: "pr6", number: 306, kind: "company", name: "שיפוצי גל", contactName: "גל מזרחי", phone: "+972521230006", email: "gal@example.com", trades: ["structural", "cleaning", "other"], serviceAreaIds: ["a3", "a2"], extraCities: ["חולון"], rating: 4, active: true },
  { id: "pr7", number: 307, kind: "company", name: "הדברה ירוקה", phone: "+972521230007", trades: ["pests"], serviceAreaIds: ["a1"], extraCities: [], active: false, notes: "לא פעיל – פג תוקף ביטוח" },
];

export const issues: Issue[] = [
  { id: "i1", number: 1042, propertyId: "p1", customerId: "c1", reporter: { type: "tenant", id: "t1" }, assigneeId: "u1", title: "נזילה מתחת לכיור במטבח", description: "מים מצטברים בארון מתחת לכיור, הרצפה רטובה.", category: "plumbing", location: "מטבח", urgency: "emergency", status: "new", openedAt: at(0, 8) },
  { id: "i2", number: 1041, propertyId: "p3", customerId: "c3", reporter: { type: "tenant", id: "t3" }, assigneeId: "u2", professionalId: "pr3", title: "מזגן בחדר הישיבות לא מקרר", description: "המזגן פועל אך מוציא אוויר חם.", category: "hvac", location: "חדר ישיבות", urgency: "high", status: "awaiting_approval", openedAt: at(-3, 11) },
  { id: "i3", number: 1040, propertyId: "p4", customerId: "c4", reporter: { type: "tenant", id: "t4" }, assigneeId: "u1", title: "תריס חשמלי תקוע", description: "התריס בחזית החנות לא נפתח עד הסוף.", category: "electrical", location: "חזית", urgency: "normal", status: "awaiting_approval", openedAt: at(-5, 9) },
  { id: "i4", number: 1039, propertyId: "p5", customerId: "c5", reporter: { type: "tenant", id: "t5" }, assigneeId: "u2", professionalId: "pr1", title: "Boiler not heating", description: "No hot water since yesterday evening.", category: "plumbing", location: "Bathroom", urgency: "high", status: "scheduled", openedAt: at(-2, 19) },
  { id: "i5", number: 1038, propertyId: "p2", customerId: "c2", reporter: { type: "tenant", id: "t2" }, assigneeId: "u1", professionalId: "pr5", title: "דלת הכניסה לא ננעלת", description: "המנעול מסתובב בלי לנעול.", category: "locks", location: "כניסה", urgency: "high", status: "in_progress", openedAt: at(-1, 14) },
  { id: "i6", number: 1037, propertyId: "p6", customerId: "c6", reporter: { type: "tenant", id: "t6" }, assigneeId: "u2", professionalId: "pr6", title: "רטיבות בקיר חדר השינה", description: "כתם רטיבות מתרחב ליד החלון.", category: "structural", location: "חדר שינה", urgency: "normal", status: "awaiting_quote", openedAt: at(-8, 10) },
  { id: "i7", number: 1036, propertyId: "p8", customerId: "c3", reporter: { type: "tenant", id: "t8" }, title: "תאורה במחסן מהבהבת", description: "שלוש מנורות במחסן מהבהבות.", category: "electrical", location: "מחסן", urgency: "low", status: "under_review", openedAt: at(-4, 13) },
  { id: "i8", number: 1035, propertyId: "p10", customerId: "c4", reporter: { type: "tenant", id: "t5" }, assigneeId: "u1", title: "Dishwasher leaking", description: "Small puddle after each cycle.", category: "appliances", location: "Kitchen", urgency: "normal", status: "awaiting_signoff", openedAt: at(-12, 16) },
  { id: "i9", number: 1034, propertyId: "p7", customerId: "c6", reporter: { type: "customer", id: "c6" }, assigneeId: "u1", professionalId: "pr6", title: "צביעה והכנה לשוכר הבא", description: "הדירה התפנתה, נדרשת צביעה וניקיון.", category: "cleaning", urgency: "normal", status: "approved", openedAt: at(-9, 9) },
  { id: "i10", number: 1033, propertyId: "p1", customerId: "c1", reporter: { type: "tenant", id: "t1" }, assigneeId: "u1", professionalId: "pr1", title: "החלפת ברז באמבטיה", description: "הברז מטפטף.", category: "plumbing", location: "אמבטיה", urgency: "low", status: "closed", openedAt: at(-40, 10), closedAt: at(-35, 15), resolution: "הוחלף ברז.", actualCostMinor: 45000 },
  { id: "i11", number: 1032, propertyId: "p3", customerId: "c3", reporter: { type: "user", id: "u2" }, assigneeId: "u2", professionalId: "pr2", title: "בדיקה תקופתית למערכת כיבוי", description: "בדיקה שנתית.", category: "other", urgency: "normal", status: "closed", openedAt: at(-60, 10), closedAt: at(-55, 12), resolution: "בוצעה בדיקה, תקין.", actualCostMinor: 0 },
  { id: "i12", number: 1031, propertyId: "p9", customerId: "c1", reporter: { type: "customer", id: "c1" }, assigneeId: "u1", title: "הדברה לפני השכרה", description: "", category: "pests", urgency: "low", status: "cancelled", openedAt: at(-20, 10), closedAt: at(-18, 10), resolution: "בוטל על ידי הלקוח." },
  { id: "i14", number: 1020, propertyId: "p1", customerId: "c1", reporter: { type: "tenant", id: "t11" }, assigneeId: "u1", professionalId: "pr1", title: "החלפת דוד שמש", description: "הדוד דולף מהתחתית.", category: "plumbing", location: "גג", urgency: "high", status: "closed", openedAt: at(-420, 9), closedAt: at(-416, 14), resolution: "הותקן דוד חדש 150 ליטר.", actualCostMinor: 380000 },
  { id: "i15", number: 1025, propertyId: "p2", customerId: "c2", reporter: { type: "tenant", id: "t12" }, assigneeId: "u1", professionalId: "pr3", title: "Air conditioner service", description: "Annual service before summer.", category: "hvac", urgency: "low", status: "closed", openedAt: at(-560, 10), closedAt: at(-555, 12), resolution: "Cleaned filters, refilled gas.", actualCostMinor: 65000 },
  { id: "i16", number: 1044, propertyId: "p11", customerId: "c3", reporter: { type: "tenant", id: "t9" }, assigneeId: "u2", professionalId: "pr4", title: "המעלית בבניין נעצרת בין קומות", description: "המעלית נעצרה פעמיים השבוע בין קומה 1 ל־2.", category: "elevator", location: "מעלית", urgency: "high", status: "scheduled", openedAt: at(-1, 10) },
  { id: "i17", number: 1028, propertyId: "p13", customerId: "c3", reporter: { type: "user", id: "u2" }, assigneeId: "u2", professionalId: "pr6", title: "צביעה וחלוקה מחדש לאחר עזיבת שוכר", description: "", category: "other", urgency: "normal", status: "closed", openedAt: at(-85, 9), closedAt: at(-60, 16), resolution: "צביעה מלאה והסרת מחיצה.", actualCostMinor: 1450000 },
  { id: "i18", number: 1026, propertyId: "p12", customerId: "c3", reporter: { type: "tenant", id: "t9" }, assigneeId: "u2", professionalId: "pr2", title: "שקעים לא עובדים בחדר הישיבות", description: "", category: "electrical", location: "חדר ישיבות", urgency: "normal", status: "closed", openedAt: at(-200, 11), closedAt: at(-197, 13), resolution: "הוחלף מפסק פחת.", actualCostMinor: 72000 },
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

// --- Form and message templates ---
// Placeholders are listed per record type in src/data/templates.ts.

export const formTemplates: FormTemplate[] = [
  {
    id: "ft1",
    name: "פרוטוקול מסירת נכס לשוכר",
    context: "lease",
    kind: "document",
    updatedAt: at(-3, 12),
    body: {
      he: `# פרוטוקול מסירת נכס
{{company.name}} · {{company.phone}} · תאריך: {{today}}

## פרטי הנכס
כתובת: {{property.fullAddress}}
סוג: {{property.kind}} · שטח: {{property.area}} מ״ר · חדרים: {{property.rooms}}
בעלי הנכס: {{owner.name}}

## פרטי השוכר
שם: {{tenant.name}} · ת.ז. / ח.פ.: {{tenant.taxId}}
טלפון: {{tenant.phone}} · דוא״ל: {{tenant.email}}
תקופת השכירות: {{lease.start}} – {{lease.end}} · שכר דירה חודשי: {{lease.rent}}

## קריאות מונים
- חשמל: ____________
- מים: ____________
- גז: ____________

## מצב הנכס
[ ] קירות וצבע תקינים
[ ] ברזים וניקוז תקינים
[ ] חלונות ותריסים תקינים
[ ] מכשירי חשמל תקינים
הערות: __________________________________________

## מפתחות
מספר מפתחות שנמסרו: ______  שלטים: ______

---
חתימת השוכר: ______________      חתימת נציג החברה: ______________`,
      en: `# Property Handover Protocol
{{company.name}} · {{company.phone}} · Date: {{today}}

## Property
Address: {{property.fullAddress}}
Type: {{property.kind}} · Area: {{property.area}} m² · Rooms: {{property.rooms}}
Owner: {{owner.name}}

## Tenant
Name: {{tenant.name}} · ID / company no.: {{tenant.taxId}}
Phone: {{tenant.phone}} · Email: {{tenant.email}}
Lease term: {{lease.start}} – {{lease.end}} · Monthly rent: {{lease.rent}}

## Meter readings
- Electricity: ____________
- Water: ____________
- Gas: ____________

## Condition
[ ] Walls and paint in good order
[ ] Taps and drains working
[ ] Windows and shutters working
[ ] Appliances working
Notes: __________________________________________

## Keys
Keys handed over: ______  Remotes: ______

---
Tenant signature: ______________      Company representative: ______________`,
    },
  },
  {
    id: "mt1",
    name: "דרישת תשלום",
    context: "payment_request",
    kind: "message",
    updatedAt: at(-30, 10),
    body: {
      he: `שלום {{customer.name}},
מצורפת דרישת תשלום מס׳ {{request.number}} עבור {{request.description}}.
סכום לתשלום: {{request.amount}}, עד {{request.due}}.
להעברה: {{company.bankDetails}}.
תודה, {{company.name}}`,
      en: `Hello {{customer.name}},
Payment request no. {{request.number}} for {{request.description}}.
Amount due: {{request.amount}}, by {{request.due}}.
Bank transfer: {{company.bankDetails}}.
Thank you, {{company.name}}`,
    },
  },
  {
    id: "mt2",
    name: "תזכורת לפני מועד התשלום",
    context: "payment_request",
    kind: "message",
    updatedAt: at(-30, 10),
    body: {
      he: `שלום {{customer.name}}, תזכורת: דרישת תשלום מס׳ {{request.number}} בסך {{request.balance}} לתשלום עד {{request.due}}. אם כבר שילמת – תודה, אפשר להתעלם מההודעה. {{company.name}}`,
      en: `Hello {{customer.name}}, a reminder: payment request no. {{request.number}} for {{request.balance}} is due on {{request.due}}. If you have already paid, thank you — please ignore this message. {{company.name}}`,
    },
  },
  {
    id: "mt3",
    name: "תזכורת על תשלום באיחור",
    context: "payment_request",
    kind: "message",
    updatedAt: at(-30, 10),
    body: {
      he: `שלום {{customer.name}}, דרישת תשלום מס׳ {{request.number}} ({{request.description}}) עדיין פתוחה. יתרה לתשלום: {{request.balance}}, מועד התשלום היה {{request.due}}. לשאלות: {{company.phone}}. {{company.name}}`,
      en: `Hello {{customer.name}}, payment request no. {{request.number}} ({{request.description}}) is still open. Balance: {{request.balance}}, due on {{request.due}}. Questions: {{company.phone}}. {{company.name}}`,
    },
  },
];

// --- Payment requests and reminder schedule: sample only until Phase 2 ---

export const reminderRules: ReminderRule[] = [
  { id: "r1", anchor: "issue_date", offsetDays: 0, channel: "preferred", templateId: "mt1", active: true },
  { id: "r2", anchor: "due_date", offsetDays: -3, channel: "preferred", templateId: "mt2", active: true },
  { id: "r3", anchor: "due_date", offsetDays: 0, channel: "preferred", templateId: "mt2", active: true },
  { id: "r4", anchor: "due_date", offsetDays: 7, channel: "preferred", templateId: "mt3", active: true },
  { id: "r5", anchor: "due_date", offsetDays: 14, channel: "whatsapp", templateId: "mt3", active: true },
];

export const paymentRequests: PaymentRequest[] = [
  { id: "rq1", number: 2201, customerId: "c1", description: "דמי ניהול – הרצל 12, ביאליק 17", amountMinor: 120000, paidMinor: 0, currency: "ILS", issueDate: date(-12), dueDate: date(-2), status: "sent" },
  { id: "rq2", number: 2202, customerId: "c2", propertyId: "p2", description: "דמי ניהול – בן יהודה 40", amountMinor: 62000, paidMinor: 20000, currency: "ILS", issueDate: date(-12), dueDate: date(-2), status: "partially_paid" },
  { id: "rq3", number: 2203, customerId: "c3", description: "דמי ניהול – משרדים ומתחם המלאכה", amountMinor: 450000, paidMinor: 450000, currency: "ILS", issueDate: date(-12), dueDate: date(-2), status: "paid" },
  { id: "rq4", number: 2204, customerId: "c4", description: "Management fee – Sokolov 55, Weizmann 31", amountMinor: 200000, paidMinor: 0, currency: "ILS", issueDate: date(-6), dueDate: date(3), status: "sent" },
  { id: "rq5", number: 2205, customerId: "c5", propertyId: "p5", description: "דמי ניהול – כצנלסון 8", amountMinor: 78000, paidMinor: 0, currency: "ILS", issueDate: date(2), dueDate: date(12), status: "scheduled" },
  { id: "rq6", number: 2190, customerId: "c6", description: "דמי ניהול – ז׳בוטינסקי 101, סוקולוב 20", amountMinor: 95000, paidMinor: 0, currency: "ILS", issueDate: date(-40), dueDate: date(-30), status: "sent" },
  { id: "rq7", number: 2191, customerId: "c6", propertyId: "p7", description: "צביעה והכנה לשוכר – סוקולוב 20", amountMinor: 240000, paidMinor: 0, currency: "ILS", issueDate: date(-25), dueDate: date(-15), status: "paused", pausedReason: "הלקוח חולק על הסכום – נבדק מול הקבלן" },
];

// Filled by the reminder job (src/data/api.ts) when the app starts, as if it had run every day.
export const outgoingMessages: OutgoingMessage[] = [];
