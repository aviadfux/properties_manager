import { Link } from "react-router";
import { PageHeader } from "@/components/ui";
import { useI18n } from "@/i18n";

export function NotFound() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t.notFound} />
      <Link to="/" className="font-semibold text-brand-700 hover:underline">
        {t.nav.dashboard}
      </Link>
    </>
  );
}
