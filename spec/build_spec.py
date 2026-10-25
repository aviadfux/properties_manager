"""Build the English and Hebrew specification files from one source.

English is the source language; Hebrew is its translation. spec/base/spec_template.docx
supplies the layout and styles, content_en.py / content_he.py hold the v1.1 base text, and
CHANGES lists every edit made since v1.1 in both languages, so the editions stay in sync.

Usage (from the project root):
    python3 -I spec/build_spec.py
"""
import os
import re
import sys
import zipfile
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from content_en import EN  # noqa: E402
from content_he import HE  # noqa: E402

BASE = os.path.join(HERE, "base", "spec_template.docx")
OUT_HE = os.path.join(ROOT, "Property_Management_CRM_Specification_HE.docx")
OUT_EN = os.path.join(ROOT, "Property_Management_CRM_Specification_EN.docx")

# ---------------------------------------------------------------------------
# Changes since v1.1. Every anchor is the start of an English base paragraph.
#   edit:  ("edit", anchor, en, he) - en / he are a full new text, or a list of (old, new) substring pairs
#   after: ("after", anchor, [blocks]) - blocks are ("h2"|"p", en, he), ("table", header, rows) or ("row", en_a, en_b, he_a, he_b)
#          header = (en_a, en_b, he_a, he_b); rows = [(en_a, en_b, he_a, he_b), ...]; "row" is only valid after a table-cell anchor
# ---------------------------------------------------------------------------
CHANGES = [
    # 01 Purpose and scope
    ("edit", "Version 1.1", [("Version 1.1", "Version 1.2")], [("גרסה 1.1", "גרסה 1.2")]),
    ("edit", "The system will serve apartments",
     [("before a vendor is engaged.", "before a vendor is engaged, except a capped emergency path for safety incidents that is approved retroactively (Section 7).")],
     [("לפני הזמנת ספק.", "לפני הזמנת ספק, למעט מסלול חירום מוגבל בסכום לאירועי בטיחות, המאושר בדיעבד (פרק 7).")]),
    ("after", "The system will serve apartments", [
        ("p", "The system is built as a generic product that supports several management companies, but is initially deployed for a single company. Every record belongs to an organization, data is isolated per organization on the server, and every company-specific setting — name, branding, language, currency, tax rates, invoicing-provider credentials and approval rules — is configuration, not code. Self-service sign-up and billing of management companies are out of scope until a second company is onboarded.",
         "המערכת תיבנה כמוצר כללי התומך במספר חברות ניהול, אך תופעל בתחילה עבור חברה אחת. כל רשומה תשויך לארגון, הנתונים יופרדו בין ארגונים בצד השרת, וכל הגדרה ייחודית לחברה – שם, מיתוג, שפה, מטבע, שיעורי מס, פרטי ספק החשבוניות וכללי אישור – תוגדר בהגדרות ולא בקוד. הרשמה עצמית של חברות ניהול וחיובן אינן כלולות עד לקליטת חברה שנייה."),
    ]),
    ("edit", "Section 2: data and clients",
     [(" Section 12: review notes and proposed additions.", "")],
     "פרק 2: נתונים ולקוחות. פרק 3: מסכים ודשבורד. פרקים 4 עד 6: תמחור, גבייה ותקציבים. פרק 7: תחזוקה ואישורים. פרק 8: פורטל והרשאות. פרק 9: תשתית, חיבורים ודרישות איכות. פרק 10: בדיקות קבלה ותוכנית ביצוע. פרק 11: גרסת ההשקה ואמצעי תשלום."),

    # 02 Data model and clients
    ("edit", "Name, client type",
     "Name, client type, phone, email, business / tax ID where applicable, billing address, paying party, preferred language and channel, and messaging consent",
     "שם, סוג לקוח, טלפון, דוא״ל, מזהה עסקי לפי הצורך, כתובת חיוב, גורם משלם, שפה וערוץ מועדפים והסכמה לקבלת הודעות"),
    ("edit", "Client, properties, validity",
     "Client, properties, validity, price, calculation basis, billing dates, adjustment rules, owner-approval threshold and signed copy",
     "לקוח, נכסים, תוקף, מחיר, בסיס חישוב, מועדי חיוב, כללי עדכון, סף אישור בעלים ועותק חתום"),
    ("edit", "Unit, parties, term",
     "Unit, parties, term, rent used for calculation, indexation, options and notice deadlines, guarantees, documents and reminders",
     "יחידה, צדדים, תקופה, שכר דירה לצורך חישוב, הצמדה, אופציות ומועדי הודעה, ערבויות, מסמכים ותזכורות"),
    ("edit", "Trade, contact and payment",
     "Trade, contact and payment details, documents, insurance and licenses with expiry, rating and active status",
     "תחום, פרטי קשר ותשלום, מסמכים, ביטוח ורישיונות ותוקפם, דירוג וסטטוס פעילות"),
    ("after", "Trade, contact and payment", [
        ("row", "Organization", "Name, branding, language, currency, tax settings, provider credentials and approval rules",
         "ארגון", "שם, מיתוג, שפה, מטבע, הגדרות מס, פרטי חיבור לספקים וכללי אישור"),
        ("row", "Guarantee / deposit", "Type (bank guarantee, promissory note, cash deposit), amount, provider, expiry, release conditions and linked lease",
         "ערבות ופיקדון", "סוג (ערבות בנקאית, שטר חוב, פיקדון כספי), סכום, מוסר, תוקף, תנאי שחרור ושיוך לחוזה שכירות"),
        ("row", "Insurance policy", "Insured party, building or vendor, coverage, expiry and policy document",
         "פוליסת ביטוח", "מבוטח, בניין או ספק, כיסוי, תוקף ומסמך הפוליסה"),
    ]),
    ("after", "Converting a lead to a client", [
        ("p", "Leasing pipeline, separate from the sales pipeline, for finding tenants for vacant units: vacancy, listing, inquiry, viewing, application and screening, lease signing and move-in. Each vacancy shows its days vacant and asking rent; each applicant has a source, status and next action.",
         "צינור השכרה, נפרד מצינור המכירה, לאיתור שוכרים ליחידות פנויות: יחידה פנויה, פרסום, פנייה, סיור, הגשת מועמדות ובדיקה, חתימת חוזה וכניסה לנכס. לכל יחידה פנויה יוצגו ימי הפניות ושכר הדירה המבוקש; לכל מועמד יהיו מקור, סטטוס והפעולה הבאה."),
        ("p", "Ending a management agreement starts an offboarding flow: final statement and open balances, handover of documents and keys, revocation of portal access, and retention of records according to the retention policy.",
         "סיום הסכם ניהול יפעיל תהליך סיום התקשרות: דוח סופי ויתרות פתוחות, מסירת מסמכים ומפתחות, ביטול גישה לפורטל ושמירת רשומות לפי מדיניות השמירה."),
        ("h2", "Lease Lifecycle", "מחזור חיי חוזה השכירות"),
        ("p", "Move-in and move-out are recorded with photos, condition notes, meter readings and key handover. A tenant change creates a checklist for transferring electricity, water, gas and municipal-tax accounts, with confirmation documents. Guarantees and deposits are tracked until release, which requires a final balance check. Renewal options create reminders before the notice deadline.",
         "כניסת שוכר ויציאתו יתועדו עם תמונות, מצב הנכס, קריאות מונים ומסירת מפתחות. החלפת שוכר תיצור רשימת משימות להעברת חשבונות חשמל, מים, גז וארנונה, עם אסמכתאות. ערבויות ופיקדונות יינוהלו עד לשחרורם, שיחייב בדיקת יתרה סופית. אופציות להארכה ייצרו תזכורת לפני המועד האחרון למתן הודעה."),
        ("h2", "Glossary", "מילון מונחים"),
        ("table", ("Term", "Definition", "מונח", "הגדרה"), [
            ("Organization", "A management company using the system; every record belongs to exactly one organization",
             "ארגון", "חברת ניהול המשתמשת במערכת; כל רשומה שייכת לארגון אחד בלבד"),
            ("Client", "The party that signs a management agreement with the company",
             "לקוח", "הגורם שחתם על הסכם ניהול עם החברה"),
            ("Owner", "The registered owner of a unit; may or may not be the client",
             "בעלים", "הבעלים הרשום של יחידה; יכול להיות הלקוח או גורם אחר"),
            ("Tenant / occupant", "The person or business occupying a unit under a lease",
             "שוכר / מחזיק", "אדם או עסק המחזיק ביחידה מכוח חוזה שכירות"),
            ("Payer", "The party actually billed for a specific charge; may differ from the liable party",
             "גורם משלם", "הגורם שמחויב בפועל בחיוב מסוים; יכול להיות שונה מהחייב"),
            ("Managing Director", "The organization's principal administrator and expense approver",
             "מנהל ראשי", "המנהל הראשי של הארגון ומאשר ההוצאות"),
        ]),
    ]),

    # 03 Screens and dashboard
    ("edit", "Main menu:",
     [("Clients & Leads, Properties", "Clients & Leads, Leasing, Properties"), ("Tasks, Reports", "Tasks, Calendar, Reports")],
     [("לקוחות ולידים, נכסים", "לקוחות ולידים, השכרה, נכסים"), ("משימות, דוחות", "משימות, יומן, דוחות")]),
    ("after", "Leads without follow-up", [
        ("row", "Expiring items", "Guarantees, insurance policies, vendor documents and renewal-option deadlines due in the next 60 days",
         "פריטים לקראת תפוגה", "ערבויות, פוליסות ביטוח, מסמכי ספקים ומועדי מימוש אופציות ב־60 הימים הקרובים"),
    ]),
    ("after", "Property card:", [
        ("h2", "Unified Calendar", "יומן מרוכז"),
        ("p", "One calendar for lease expiries, renewal-option deadlines, inspections and maintenance, cheque deposit dates, guarantee expiries and document renewals, with reminders to the responsible user. Every calendar item links to its source record.",
         "יומן אחד לסיומי חוזים, מועדי מימוש אופציות, בדיקות ותחזוקה, מועדי הפקדת המחאות, תפוגת ערבויות וחידוש מסמכים, עם תזכורות לאחראי. כל פריט ביומן מקושר לרשומת המקור."),
    ]),

    # 04 Pricing and billing
    ("after", "Illustrative calculation only", [
        ("h2", "Indexation, Late Fees and Payment Plans", "הצמדה, ריבית פיגורים והסדרי תשלום"),
        ("p", "Indexation of rent or fees (e.g., to the consumer price index) creates a new price version from its effective date, using the index source, base month and floor rules defined in the agreement; past charges are never recalculated. Late fees are charged only where the contract allows them and the policy is approved, and appear as a separate charge line. A payment plan for an existing debt splits repayment into installments while the original charges remain intact and traceable.",
         "הצמדה של שכר דירה או דמי ניהול (למשל למדד המחירים לצרכן) תיצור גרסת מחיר חדשה ממועד התחולה, לפי מקור המדד, מדד הבסיס וכללי הרצפה שהוגדרו בהסכם; חיובי עבר לא יחושבו מחדש. ריבית או דמי פיגורים ייגבו רק אם ההסכם מתיר זאת והמדיניות אושרה, ויוצגו כשורת חיוב נפרדת. הסדר תשלומים לחוב קיים יפצל את הפירעון לתשלומים, והחיובים המקוריים יישמרו ויהיו ניתנים למעקב."),
    ]),

    # 05 Payment requests and documents
    ("after", "Suggested reminders:", [
        ("h2", "Bank Statement Import and Accountant Export", "ייבוא דפי בנק וייצוא לרואה החשבון"),
        ("p", "Bank statements (CSV / Excel) can be imported; the system suggests matches between incoming transfers and open charges, and an authorized user confirms each match before it counts as verification. This is an intermediate step before automatic bank reconciliation. A periodic export of charges, receipts, documents and expenses is produced in a format agreed with the accountant, who may also get a read-only role.",
         "ניתן לייבא דפי בנק (CSV או Excel); המערכת תציע התאמות בין העברות נכנסות לחיובים פתוחים, ומשתמש מורשה יאשר כל התאמה לפני שתיחשב כאימות. זהו שלב ביניים לפני התאמת בנק אוטומטית. ייצוא תקופתי של חיובים, תקבולים, מסמכים והוצאות יופק בפורמט שיוסכם עם רואה החשבון, שיוכל לקבל גם הרשאת צפייה בלבד."),
    ]),

    # 06 Building finances and expenses
    ("edit", "Request and quote;",
     [("approval by the Managing Director; budget commitment;", "approval by the Managing Director; owner consent when the amount exceeds the agreement's threshold; budget commitment;")],
     [("אישור המנהל הראשי; התחייבות תקציבית;", "אישור המנהל הראשי; הסכמת הבעלים כאשר הסכום חורג מהסף שנקבע בהסכם; התחייבות תקציבית;")]),

    # 07 Maintenance and approvals
    ("edit", "The approval is limited to the vendor",
     [("There is no emergency path that bypasses the Managing Director; an urgent request triggers an immediate alert.", "An urgent request triggers an immediate alert; the emergency path is described below.")],
     [("אין מסלול חירום שמדלג על המנהל הראשי; קריאה דחופה תיצור התרעה מיידית.", "קריאה דחופה תיצור התרעה מיידית; מסלול החירום מתואר בהמשך.")]),
    ("after", "The approval is limited to the vendor", [
        ("h2", "Emergency Path and Backup Approver", "מסלול חירום ומאשר מחליף"),
        ("p", "For safety incidents in defined categories (e.g., flooding, gas leak, electrical hazard, lock-out, elevator entrapment), an authorized employee may engage a vendor up to an emergency cap set per organization, without prior approval. The action triggers an immediate alert, is flagged for retroactive approval by the Managing Director within 24 hours and stays on the dashboard until approved. Above the cap, prior approval is always required. The Managing Director can appoint a backup approver, with a validity period and an amount limit, for times they are unavailable; every approval records who approved and under which authority.",
         "באירועי בטיחות בקטגוריות מוגדרות (למשל הצפה, דליפת גז, סכנה חשמלית, נעילה מחוץ לנכס, לכידה במעלית) עובד מורשה יוכל להזמין ספק עד לתקרת חירום שתוגדר לכל ארגון, ללא אישור מראש. הפעולה תיצור התרעה מיידית, תסומן לאישור בדיעבד של המנהל הראשי בתוך 24 שעות ותוצג בדשבורד עד לאישורה. מעל התקרה נדרש תמיד אישור מראש. המנהל הראשי יוכל למנות מאשר מחליף, לתקופה ובתקרת סכום מוגדרות, לזמנים שבהם אינו זמין; כל אישור ישמור מי אישר ובאיזו סמכות."),
        ("h2", "Owner Consent", "הסכמת בעלים"),
        ("p", "When the management agreement sets an owner-approval threshold and the cost borne by the owner exceeds it, the work order stays blocked until the owner's consent is recorded (method, date, amount and scope). Consent is requested through a logged message and stored with the expense.",
         "כאשר הסכם הניהול קובע סף אישור בעלים והעלות החלה על הבעלים חורגת ממנו, הזמנת העבודה תיחסם עד לתיעוד הסכמת הבעלים (אופן, מועד, סכום והיקף). הבקשה תישלח לבעלים בהודעה מתועדת וההסכמה תישמר עם ההוצאה."),
    ]),
    ("after", "The maintenance schedule includes", [
        ("p", "Vendor insurance policies, licenses and certificates are tracked with expiry dates; a vendor whose mandatory documents have expired cannot be assigned. Statutory building inspections (elevators, fire safety, gas systems) and building insurance renewals feed the maintenance schedule and the calendar.",
         "פוליסות ביטוח, רישיונות ותעודות של ספקים יישמרו עם תאריכי תוקף; לא ניתן יהיה לשבץ ספק שמסמכי החובה שלו פגו. בדיקות חובה בבניינים (מעליות, בטיחות אש, מערכות גז) וחידוש ביטוח המבנה יוזנו ללוח התחזוקה וליומן."),
    ]),
    ("after", "The tenant receives updates", [
        ("p", "Field staff work in a mobile view of their assigned requests, with before / after photos, vendor arrival and completion confirmation.",
         "עובדי שטח יעבדו בתצוגה מותאמת לנייד של הקריאות שהוקצו להם, עם צילומי לפני ואחרי ואישור הגעת ספק וסיום עבודה."),
    ]),

    # 08 Portal and permissions
    ("after", "Only their own personal information", [
        ("row", "Accountant (optional)", "Read-only access to charges, receipts, documents, expenses and exports",
         "רואה חשבון (אופציונלי)", "צפייה בלבד בחיובים, בתקבולים, במסמכים, בהוצאות ובייצואים"),
    ]),
    ("after", "Identity documents and payment details", [
        ("h2", "Communication", "תקשורת"),
        ("p", "Messages are sent from templates per channel and language. Each contact has a preferred language and channel and a recorded consent for non-essential messages; opt-outs are honored. All outgoing and incoming messages are kept in the communication history on the client and tenant cards.",
         "הודעות יישלחו מתוך תבניות לפי ערוץ ושפה. לכל איש קשר יוגדרו שפה וערוץ מועדפים ותתועד הסכמה לקבלת הודעות שאינן הכרחיות; בקשת הסרה תכובד. כל ההודעות היוצאות והנכנסות יישמרו בהיסטוריית התקשורת בכרטיס הלקוח והשוכר."),
        ("h2", "Privacy and Data Protection", "פרטיות והגנת מידע"),
        ("p", "The system complies with the applicable privacy law (e.g., Israel's Privacy Protection Law and its Data Security Regulations, or GDPR where relevant): a database definition document, retention periods per data type, handling of access, correction and deletion requests, data-processing agreements with vendors and a breach-notification procedure.",
         "המערכת תעמוד בדיני הפרטיות החלים (למשל חוק הגנת הפרטיות ותקנות אבטחת מידע, או GDPR לפי העניין): מסמך הגדרות מאגר, תקופות שמירה לכל סוג מידע, טיפול בבקשות עיון, תיקון ומחיקה, הסכמי עיבוד מידע עם ספקים ונוהל דיווח על אירוע אבטחה."),
    ]),

    # 09 Infrastructure and quality
    ("after", "A mobile-responsive web application", [
        ("p", "Every record belongs to an organization and is isolated per organization on the server. All UI strings are kept in translation files from day one; language, currency, tax rates with effective dates and date formats are set per organization.",
         "כל רשומה משויכת לארגון ומופרדת לפי ארגון בצד השרת. כל מחרוזות הממשק יישמרו בקובצי תרגום מהיום הראשון; שפה, מטבע, שיעורי מס עם תאריכי תחולה ותבניות תאריך יוגדרו לכל ארגון."),
    ]),
    ("after", "Card processing, WhatsApp", [
        ("h2", "AI Assistance", "סיוע בבינה מלאכותית"),
        ("p", "Optional AI features: classifying and prioritizing service requests from free text and photos; extracting data from vendor invoices and payment proofs for human confirmation; drafting replies and reminders. AI output is always a suggestion: it never approves an expense, verifies a payment or issues a document.",
         "יכולות אופציונליות: סיווג ותעדוף קריאות שירות מתוך טקסט חופשי ותמונות; חילוץ נתונים מחשבוניות ספקים ומאסמכתאות תשלום לאישור אדם; ניסוח טיוטות לתשובות ולתזכורות. תוצר הבינה המלאכותית הוא תמיד הצעה: הוא לעולם לא יאשר הוצאה, יאמת תשלום או יפיק מסמך."),
    ]),
    ("after", "Dates in the business's local time zone", [
        ("p", "A full export of all data and files in open formats is available to the organization at any time. Business monitoring raises alerts when a billing run fails, the exceptions queue grows or sync with the invoicing provider falls behind — in addition to technical error monitoring.",
         "ייצוא מלא של כל הנתונים והקבצים בפורמטים פתוחים יהיה זמין לארגון בכל עת. ניטור עסקי יתריע על כשל בהרצת חיובים, על גידול בתור החריגים או על פיגור בסנכרון מול ספק החשבוניות, בנוסף לניטור התקלות הטכני."),
    ]),

    # 10 Acceptance and plan
    ("after", "5. An employee cannot engage", [
        ("p", "11. An emergency expense within the cap is executed and flagged for retroactive approval; above the cap it is blocked. 12. A vendor with an expired insurance certificate cannot be assigned. 13. An indexation update creates a new price version without changing past charges. 14. An owner-approval threshold blocks the work order until the owner's consent is recorded. 15. A user of one organization cannot access another organization's data, even via a direct server call. 16. A tenant's access request can be fulfilled with a complete export of their personal data.",
         "11. הוצאת חירום בתוך התקרה מבוצעת ומסומנת לאישור בדיעבד; מעל התקרה היא נחסמת. 12. לא ניתן לשבץ ספק שתעודת הביטוח שלו פגה. 13. עדכון הצמדה יוצר גרסת מחיר חדשה בלי לשנות חיובי עבר. 14. סף אישור בעלים חוסם את הזמנת העבודה עד לתיעוד הסכמת הבעלים. 15. משתמש בארגון אחד אינו יכול לגשת לנתוני ארגון אחר, גם בפנייה ישירה לשרת. 16. בקשת עיון של שוכר ניתנת למימוש בייצוא מלא של המידע האישי שלו."),
    ]),
    ("after", "Open decisions:", [
        ("p", "Also to decide: emergency cap amount and categories; the backup approver; default owner-approval thresholds; whether leasing is offered at launch; languages at launch; retention periods; the phase for AI features.",
         "כמו כן יש להחליט: סכום וקטגוריות תקרת החירום; זהות המאשר המחליף; ספי ברירת מחדל לאישור בעלים; האם שירות השכרה ייכלל בהשקה; שפות בהשקה; תקופות שמירת מידע; השלב להוספת יכולות הבינה המלאכותית."),
    ]),

    # 11 Launch version
    ("after", "Start with a management core", [
        ("p", "At launch the same person approves expenses, verifies receipts and issues documents. This is an accepted, documented control gap for the pilot; once a finance role exists, receipt verification moves to a second user.",
         "בהשקה אותו אדם מאשר הוצאות, מאמת תקבולים ומפיק מסמכים. זהו פער בקרה ידוע ומתועד שמתקבל לפיילוט; עם הגדרת תפקיד כספים, אימות התקבולים יעבור למשתמש נוסף."),
    ]),
]

T_RE = re.compile(r"(<w:t(?: [^>]*)?>)([^<]*)(</w:t>)")
P_RE = re.compile(r"<w:p[ >].*?</w:p>", re.S)
FILLS = ("FFFFFF", "F7F8FA")


def set_texts(p, texts):
    """Replace the text runs of paragraph XML p with texts (one per run; extra runs are emptied)."""
    p = p.replace("<w:lastRenderedPageBreak/>", "")
    it = iter(texts)
    return T_RE.sub(lambda m: '<w:t xml:space="preserve">' + escape(next(it, "")) + "</w:t>", p)


def strip_ids(x):
    return re.sub(r'\sw14:(paraId|textId)="[0-9A-F]+"', "", x)


def apply_edit(text, spec):
    if isinstance(spec, str):
        return spec
    for old, new in spec:
        assert old in text, f"edit target not found: {old!r} in {text[:60]!r}"
        text = text.replace(old, new)
    return text


def build(lang):
    he = lang == "he"
    z = zipfile.ZipFile(BASE)
    files = {n: z.read(n) for n in z.namelist()}
    doc = files["word/document.xml"].decode()

    # Index the non-empty paragraphs; they line up one-to-one with EN.
    paras = [m for m in P_RE.finditer(doc) if any(t[1].strip() for t in T_RE.findall(m.group(0)))]
    assert len(paras) == len(EN) == len(HE), (len(paras), len(EN), len(HE))

    def find(anchor):
        hits = [i for i, e in enumerate(EN) if (e[0] if isinstance(e, list) else e).startswith(anchor)]
        assert len(hits) == 1, f"anchor {anchor!r} matched {len(hits)} paragraphs"
        return hits[0]

    # Templates cloned from the base document.
    all_paras = P_RE.findall(doc)
    pick = lambda pred: strip_ids(next(p for p in all_paras if pred(p)))
    h2_t = pick(lambda p: 'w:val="Heading2"' in p)
    body_t = pick(lambda p: "<w:pStyle" not in p and "<w:t" in p and "w:spacing" not in p)
    gap_t = pick(lambda p: '<w:spacing w:after="0"/>' in p and "<w:t" not in p)
    tbl_t = strip_ids(re.search(r"<w:tbl>.*?</w:tbl>", doc, re.S).group(0))

    def fill_row(tr, a, b):
        cells = re.findall(r"<w:tc>.*?</w:tc>", tr, re.S)
        for old, text in zip(cells, (a, b)):
            tr = tr.replace(old, set_texts(old, [text]), 1)
        return tr

    def new_table(header, rows):
        trs = re.findall(r"<w:tr[ >].*?</w:tr>", tbl_t, re.S)
        pick2 = (lambda r: (r[2], r[3])) if he else (lambda r: (r[0], r[1]))
        body = "".join(fill_row(trs[1], *pick2(r)) for r in rows)
        widths = re.findall(r'<w:gridCol w:w="(\d+)"/>', tbl_t)
        out = tbl_t[: tbl_t.find(trs[0])] + fill_row(trs[0], *pick2(header)) + body + tbl_t[tbl_t.rfind(trs[-1]) + len(trs[-1]):]
        for o, n in zip(widths, ("2304", "7632")):
            out = out.replace(f'w:w="{o}"', f'w:w="{n}"')
        return out

    edits = []  # (start, end, new_xml)
    for op in CHANGES:
        i = find(op[1])
        m = paras[i]
        if op[0] == "edit":
            spec = op[3] if he else op[2]
            p = m.group(0)
            base = (HE if he else EN)[i]
            texts = list(base) if isinstance(base, list) else [base]
            texts[0] = apply_edit(texts[0], spec)
            edits.append((m.start(), m.end(), set_texts(p, texts)))
            continue
        blocks = op[2]
        if blocks[0][0] == "row":
            row_start = [t.start() for t in re.finditer(r"<w:tr[ >]", doc[: m.start()])][-1]
            row_end = doc.find("</w:tr>", m.end()) + len("</w:tr>")
            row = strip_ids(doc[row_start:row_end])
            xml = "".join(fill_row(row, *((b[3], b[4]) if he else (b[1], b[2]))) for b in blocks)
            edits.append((row_end, row_end, xml))
            continue
        xml = ""
        for b in blocks:
            if b[0] == "h2":
                xml += set_texts(h2_t, [b[2] if he else b[1]])
            elif b[0] == "p":
                xml += set_texts(body_t, [b[2] if he else b[1]])
            elif b[0] == "table":
                xml += new_table(b[1], b[2]) + gap_t
        edits.append((m.end(), m.end(), xml))

    # Untouched paragraphs get the base text of the language.
    edited = {s for s, e, _ in edits if s != e}
    for i, m in enumerate(paras):
        if m.start() not in edited:
            base = (HE if he else EN)[i]
            texts = base if isinstance(base, list) else [base]
            edits.append((m.start(), m.end(), set_texts(m.group(0), texts)))

    # Apply from the end. An insertion at the end of one paragraph shares its position with the start of
    # the next, so at equal positions the replacement is applied first and the insertion lands before it.
    for s, e, x in sorted(edits, key=lambda t: (t[0], t[1] > t[0]), reverse=True):
        doc = doc[:s] + x + doc[e:]

    # Re-stripe table body rows after inserting rows.
    def stripe(tm):
        rows = re.findall(r"<w:tr[ >].*?</w:tr>", tm.group(0), re.S)
        t = tm.group(0)
        for k, r in enumerate(rows[1:]):
            t = t.replace(r, re.sub(r'w:fill="[0-9A-F]{6}"', f'w:fill="{FILLS[k % 2]}"', r), 1)
        return t
    doc = re.sub(r"<w:tbl>.*?</w:tbl>", stripe, doc, flags=re.S)

    if not he:
        ltr = lambda x: x.replace("<w:bidi/>", "").replace("<w:bidiVisual/>", "").replace("<w:rtl/>", "")
        doc = ltr(doc)
        for n in ("word/styles.xml", "word/footer1.xml"):
            files[n] = ltr(files[n].decode()).encode()
        core = files["docProps/core.xml"].decode()
        core = re.sub(r"<dc:title>.*?</dc:title>", "<dc:title>Management System Specification for a Property Management Company</dc:title>", core)
        core = re.sub(r"<dc:creator>.*?</dc:creator>", "<dc:creator></dc:creator>", core)
        files["docProps/core.xml"] = core.encode()

    files["word/document.xml"] = doc.encode()
    out = OUT_HE if he else OUT_EN
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as o:
        for n in z.namelist():
            o.writestr(z.getinfo(n), files[n])
    print("wrote", os.path.relpath(out, ROOT))


if __name__ == "__main__":
    build("he")
    build("en")
