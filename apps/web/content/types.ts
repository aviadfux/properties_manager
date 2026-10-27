export type Dictionary = {
  meta: { title: string; description: string };
  skipToContent: string;
  nav: { services: string; howItWorks: string; faq: string; contact: string; otherLanguage: string; menu: string };
  hero: { eyebrow: string; title: string; subtitle: string; whatsapp: string; call: string };
  services: { title: string; intro: string; items: { title: string; text: string }[] };
  howItWorks: { title: string; steps: { title: string; text: string }[] };
  why: { title: string; items: { title: string; text: string }[] };
  faq: { title: string; items: { q: string; a: string }[] };
  contact: {
    title: string;
    text: string;
    form: {
      name: string;
      phone: string;
      propertyType: string;
      propertyTypes: string[];
      city: string;
      message: string;
      optional: string;
      submit: string;
      note: string;
      required: string;
      invalidPhone: string;
      whatsappIntro: string;
    };
    orCall: string;
  };
  footer: { accessibility: string; privacy: string; rights: string };
  legal: {
    backHome: string;
    accessibility: { title: string; sections: { heading: string; body: string[] }[] };
    privacy: { title: string; sections: { heading: string; body: string[] }[] };
  };
};
