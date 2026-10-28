import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { Layout } from "@/components/Layout";
import { I18nProvider } from "@/i18n";
import { CustomerDetail, Customers } from "@/pages/Customers";
import { Dashboard } from "@/pages/Dashboard";
import { IssueDetail, Issues } from "@/pages/Issues";
import { NotFound } from "@/pages/NotFound";
import { Properties, PropertyDetail } from "@/pages/Properties";
import { TenantDetail, Tenants } from "@/pages/Tenants";
import { Todo } from "@/pages/Todo";
import "@fontsource-variable/heebo";
import "./index.css";

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Dashboard /> },
      { path: "/todo", element: <Todo /> },
      { path: "/customers", element: <Customers /> },
      { path: "/customers/:id", element: <CustomerDetail /> },
      { path: "/properties", element: <Properties /> },
      { path: "/properties/:id", element: <PropertyDetail /> },
      { path: "/tenants", element: <Tenants /> },
      { path: "/tenants/:id", element: <TenantDetail /> },
      { path: "/issues", element: <Issues /> },
      { path: "/issues/:id", element: <IssueDetail /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

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
