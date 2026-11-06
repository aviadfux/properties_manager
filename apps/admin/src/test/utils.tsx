// Helpers shared by the tests.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { I18nProvider } from "@/i18n";
import { routes } from "@/routes";

/** The frozen "today" of every test (see setup.ts). */
export const TODAY = "2026-11-05";

export const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10);

/** Renders the whole app (layout, sidebar, search) at a URL, in English unless asked otherwise. */
export function renderApp(path: string, locale: "en" | "he" = "en") {
  localStorage.setItem("admin.locale", locale);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: "always" } } });
  render(
    <I18nProvider>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nProvider>,
  );
  return router;
}
