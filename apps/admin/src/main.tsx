import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { I18nProvider } from "@/i18n";
import { routes } from "@/routes";
import "@fontsource-variable/heebo";
import "./index.css";

const router = createBrowserRouter(routes);

const queryClient = new QueryClient({ defaultOptions: {
    // Sample data is local, so never pause queries when the browser reports being offline.
    // Revisit when the real API is connected.
    queries: { staleTime: 30_000, retry: 1, networkMode: "always" },
  } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nProvider>
  </StrictMode>,
);
