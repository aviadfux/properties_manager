// The app's pages by URL. Shared by main.tsx (browser router) and the tests (memory router).
import type { RouteObject } from "react-router";
import { Layout } from "@/components/Layout";
import { AgreementDetail, Agreements, ImportAgreement, NewAgreement } from "@/pages/Agreements";
import { CustomerDetail, Customers } from "@/pages/Customers";
import { Dashboard } from "@/pages/Dashboard";
import { FormEditor, Forms } from "@/pages/Forms";
import { IssueDetail, Issues } from "@/pages/Issues";
import { NotFound } from "@/pages/NotFound";
import { Payments } from "@/pages/Payments";
import { ProfessionalDetail, Professionals } from "@/pages/Professionals";
import { Properties, PropertyDetail } from "@/pages/Properties";
import { TenantDetail, Tenants } from "@/pages/Tenants";
import { Todo } from "@/pages/Todo";

export const routes: RouteObject[] = [
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
      { path: "/professionals", element: <Professionals /> },
      { path: "/professionals/:id", element: <ProfessionalDetail /> },
      { path: "/payments", element: <Payments /> },
      { path: "/agreements", element: <Agreements /> },
      { path: "/agreements/import", element: <ImportAgreement /> },
      { path: "/agreements/new", element: <NewAgreement /> },
      { path: "/agreements/:id", element: <AgreementDetail /> },
      { path: "/forms", element: <Forms /> },
      { path: "/forms/:id", element: <FormEditor /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];
