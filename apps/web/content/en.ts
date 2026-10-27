import { site } from "@/site.config";
import type { Dictionary } from "./types";

export const en: Dictionary = {
  meta: {
    title: `${site.name.en} | Property management in ${site.serviceArea.en}`,
    description:
      "Professional management for apartments, offices, shops and buildings: organized collections, responsive maintenance and full transparency for owners.",
  },
  skipToContent: "Skip to main content",
  nav: {
    services: "Services",
    howItWorks: "How it works",
    faq: "FAQ",
    contact: "Contact",
    otherLanguage: "עברית",
    menu: "Menu",
  },
  hero: {
    eyebrow: `Property management in ${site.serviceArea.en}`,
    title: "Your property, in good hands",
    subtitle:
      "Professional management for apartments, offices, shops and buildings — organized collections, responsive maintenance and full transparency on every shekel.",
    whatsapp: "Message us on WhatsApp",
    call: `Call: ${site.phone.display}`,
  },
  services: {
    title: "What we manage",
    intro: "One service that adapts to the property — from a single apartment to an entire building.",
    items: [
      {
        title: "Residential apartments",
        text: "End-to-end rental support: payment tracking, reminders, maintenance and ongoing contact with tenants.",
      },
      {
        title: "Offices, shops and commercial properties",
        text: "Lease management, tracking of dates and options, maintenance and clear reporting to owners.",
      },
      {
        title: "Buildings and homeowners' associations",
        text: "Annual budget, HOA fee collection, regular vendors and preventive maintenance of common areas.",
      },
    ],
  },
  howItWorks: {
    title: "How it works",
    steps: [
      { title: "Introductory call", text: "Tell us about the property and what matters to you." },
      { title: "Property visit", text: "We get to know the property, the tenants and the needs first-hand." },
      {
        title: "Tailored proposal",
        text: "A fixed monthly fee, a percentage of rent or building pricing — whatever suits you.",
      },
      { title: "Ongoing management", text: "We handle the day-to-day, and you receive a clear report." },
    ],
  },
  why: {
    title: "Why work with us",
    items: [
      {
        title: "No major expense without your approval",
        text: "Expenses above the amount we agreed are approved by you in advance, with a clear quote.",
      },
      { title: "Full transparency", text: "A periodic report of services, expenses and balances — no surprises." },
      {
        title: "Repairs handled by urgency",
        text: "Safety issues get immediate priority, and every request is tracked until it is closed.",
      },
      { title: "One point of contact", text: "One person for everything — for you and for your tenants." },
    ],
  },
  faq: {
    title: "Frequently asked questions",
    items: [
      {
        q: "How much does property management cost?",
        a: "Pricing depends on the property and the service: a fixed monthly fee, a percentage of rent or building pricing. We'll be happy to make an offer after an introductory call.",
      },
      { q: "Which areas do you serve?", a: `We manage properties in ${site.serviceArea.en}.` },
      {
        q: "Do you collect the rent for me?",
        a: "Rent continues to be paid directly to you. We track payments, send reminders and take care of everything that happens at the property.",
      },
      {
        q: "What happens when something breaks?",
        a: "The tenant reports it to us, we assess the issue, get a quote from a suitable vendor and schedule the repair. Expenses above the amount we agreed require your approval in advance.",
      },
      {
        q: "How will I know what's happening at my property?",
        a: "You'll receive a periodic report of the services provided, expenses and balances — and you can always simply call us.",
      },
    ],
  },
  contact: {
    title: "Let's talk",
    text: "Leave a few details and we'll get back to you, or message us directly on WhatsApp.",
    form: {
      name: "Full name",
      phone: "Phone",
      propertyType: "Property type",
      propertyTypes: ["Apartment", "Office or shop", "Building", "Other"],
      city: "City",
      message: "Tell us briefly about the property",
      optional: "(optional)",
      submit: "Send via WhatsApp",
      note: "Clicking opens WhatsApp with the details you entered. This website does not store them.",
      required: "Required field",
      invalidPhone: "Please enter a valid phone number",
      whatsappIntro: "Hello, I'd like to hear about managing my property.",
    },
    orCall: "Prefer to talk?",
  },
  footer: { accessibility: "Accessibility statement", privacy: "Privacy policy", rights: "All rights reserved" },
  legal: {
    backHome: "Back to home page",
    accessibility: {
      title: "Accessibility statement",
      sections: [
        {
          heading: "Our commitment",
          body: [
            `${site.name.en} is committed to providing equal service to all customers, including people with disabilities. This website was made accessible in accordance with the Israeli Equal Rights for Persons with Disabilities (Service Accessibility Adjustments) Regulations, 2013, and Israeli Standard 5568 at level AA, based on the WCAG 2.0 guidelines.`,
          ],
        },
        {
          heading: "What we made accessible",
          body: [
            "Full keyboard navigation, including a link to skip to the main content.",
            "Heading structure and semantic markup that support screen readers.",
            "Color contrast that meets the requirements, and text that can be enlarged to 200% without losing content.",
            "A form with clear labels and accessible error messages.",
            "Layouts for mobile and desktop, in right-to-left and left-to-right languages.",
          ],
        },
        {
          heading: "Supported browsers",
          body: ["The website was tested on current versions of Chrome, Safari, Edge and Firefox, on desktop and mobile."],
        },
        {
          heading: "Found a problem?",
          body: [
            `If you find something that is not accessible, we want to hear about it and fix it. Contact our accessibility coordinator at ${site.phone.display} or on WhatsApp, and we will reply promptly.`,
          ],
        },
        { heading: "Statement updated", body: [`This statement was updated on ${site.accessibilityStatementDate.en}.`] },
      ],
    },
    privacy: {
      title: "Privacy policy",
      sections: [
        {
          heading: "What we collect",
          body: [
            "This website does not store personal information and does not use cookies or tracking tools.",
            "When you fill in the contact form, the details are not sent to the website. The button opens WhatsApp with a message containing your details, and you decide whether to send it.",
          ],
        },
        {
          heading: "How we use information",
          body: [
            "Details you send us on WhatsApp or by phone are used only to get back to you and provide the service you asked for. We do not pass them to third parties unless required by law.",
            "Sending a WhatsApp message is also subject to WhatsApp's privacy policy.",
          ],
        },
        {
          heading: "Access, correction and deletion",
          body: [`You can ask to see, correct or delete your information by calling ${site.phone.display} or on WhatsApp.`],
        },
        { heading: "Policy updated", body: [`This policy was updated on ${site.accessibilityStatementDate.en}.`] },
      ],
    },
  },
};
