import { useMutation, useQueryClient } from "@tanstack/react-query";
import { markMessageSent } from "@/data/api";
import type { OutgoingMessage } from "@/domain/types";
import { useI18n } from "@/i18n";
import { Icon } from "./icons";

/** A chat with the message already typed in; the user presses send in WhatsApp. No WhatsApp integration is involved. */
export const whatsappLink = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

export function ChannelBadge({ channel }: { channel: "whatsapp" | "email" | "phone" }) {
  const { t } = useI18n();
  const style = channel === "whatsapp" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-sky-50 text-sky-800 ring-sky-200";
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${style}`}>
      {channel !== "phone" && <Icon name={channel === "whatsapp" ? "whatsapp" : "mail"} className="h-3.5 w-3.5" />}
      {t.channels[channel]}
    </span>
  );
}

/** Opens the prepared WhatsApp message in a new tab and records it as sent. */
export function WhatsAppSendButton({ message }: { message: OutgoingMessage }) {
  const { t } = useI18n();
  const client = useQueryClient();
  const mark = useMutation({ mutationFn: () => markMessageSent(message.id), onSuccess: () => client.invalidateQueries() });
  return (
    <a
      href={whatsappLink(message.to, message.body)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => mark.mutate()}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
    >
      <Icon name="whatsapp" className="h-4 w-4" />
      {t.payments.openWhatsApp}
      <span className="sr-only">{t.payments.opensNewTab}</span>
    </a>
  );
}
