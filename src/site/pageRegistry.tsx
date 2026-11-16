import type { ReactNode } from "react";
import type { PageContentMap, PageKey, SiteContent } from "@/cms/types";
import Home from "./pages/Home";
import Portfolio from "./pages/Portfolio";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Signature from "./pages/Signature";
import Faq from "./pages/Faq";
import ComingSoon from "./pages/ComingSoon";
import Book from "./pages/Book";

/** How each CMS page renders its body. Used by the CMS live preview (the routes wire the same components). */
type Entry = { body: (c: never, site: SiteContent) => ReactNode; igVariant?: "default" | "about"; igClass?: string; bare?: boolean };

export const PAGE_REGISTRY: Record<PageKey, Entry> = {
  home: { body: (c: PageContentMap["home"]) => <Home c={c} />, igClass: "" },
  portfolio: { body: (c: PageContentMap["portfolio"]) => <Portfolio c={c} /> },
  about: { body: (c: PageContentMap["about"]) => <About c={c} />, igClass: "inner gap-top" },
  contact: { body: (c: PageContentMap["contact"], site) => <Contact c={c} site={site} /> },
  "the-tplum-signature": { body: (c: PageContentMap["the-tplum-signature"]) => <Signature c={c} /> },
  faq: { body: (c: PageContentMap["faq"], site) => <Faq c={c} site={site} /> },
  "coming-soon": { body: (c: PageContentMap["coming-soon"]) => <ComingSoon c={c} />, bare: true },
  book: { body: (c: PageContentMap["book"]) => <Book c={c} /> },
};
