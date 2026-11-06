// Decorative line icons (hidden from screen readers; the adjacent text carries the meaning).
const paths = {
  home: "M3 11.5 12 4l9 7.5M5 10v10h5v-6h4v6h5V10",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  building: "M6 21V3h12v18M3 21h18M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1",
  key: "M15 7a4 4 0 1 1-3.9 4.9L3 20v-3h3v-3h3l1.1-1.1A4 4 0 0 1 15 7m1.5 2.5h.01",
  wrench: "M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 6.6-6.6a4 4 0 0 0-5-5L13 5zM3 21l5-5",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16m10 2-4.3-4.3",
  menu: "M4 7h16M4 12h16M4 17h16",
  alert: "M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18m0-14v5l3 3",
  coin: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18m3-12h-4.5a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4H9m3-10v2m0 8v2",
  file: "M14 3H6v18h12V7zm0 0v4h4M9 13h6m-6 4h6",
  chevron: "m9 6 6 6-6 6",
  briefcase: "M3 8h18v12H3zM8 8V5h8v3M3 13h18",
  send: "M21 3 10 14M21 3l-7 18-4-7-7-4z",
  print: "M7 9V3h10v6M7 17H4v-8h16v8h-3M7 14h10v7H7z",
  // A chat bubble with a handset: stands for WhatsApp without using its logo.
  whatsapp: "M3.5 20.5 5 16a8.5 8.5 0 1 1 3 3zM9.5 8c0 3.2 2.8 6.3 6.5 6.5l.9-1.6-2.1-1.1-.9.8c-1-.5-1.9-1.4-2.4-2.4l.8-.9L11.2 7.2z",
  mail: "M3 6h18v12H3zm0 0 9 7 9-7",
  pin: "M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21m0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className ?? ""} ${name === "chevron" ? "rtl:-scale-x-100" : ""}`}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
