import "../globals.css";
import { RootDocument } from "@/components/RootDocument";

export default function HebrewLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument locale="he">{children}</RootDocument>;
}
