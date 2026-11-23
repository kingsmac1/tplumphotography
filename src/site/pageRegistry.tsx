import type { ReactNode } from "react";
import type { Video } from "@/cms/content";
import type { PageContentMap, PageKey, SiteContent } from "@/cms/types";
import Home from "./pages/Home";
import Portfolio from "./pages/Portfolio";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Signature from "./pages/Signature";
import Faq from "./pages/Faq";
import ComingSoon from "./pages/ComingSoon";
import Book from "./pages/Book";
import { ClassicVideosPage } from "./video/ClassicFilms";
import { MAbout, MBook, MContact, MFaq, MHome, MPortfolio, MSignature, MVideos } from "./m/MPages";

/**
 * How each CMS page renders, in each of the two designs (see src/site/design.tsx). Used by the page routes
 * (PageRoute.tsx) and the CMS live preview. `bare`: no header/footer (the holding page, same in both designs).
 */
type Body = (c: never, site: SiteContent, videos: Video[]) => ReactNode;
type Entry = { classic: Body; modern: Body; igVariant?: "default" | "about"; igClass?: string; bare?: boolean };

export const PAGE_REGISTRY: Record<PageKey, Entry> = {
  home: { classic: (c: PageContentMap["home"], _s, v) => <Home c={c} videos={v} />, modern: (c: PageContentMap["home"], _s, v) => <MHome c={c} videos={v} />, igClass: "" },
  portfolio: { classic: (c: PageContentMap["portfolio"]) => <Portfolio c={c} />, modern: (c: PageContentMap["portfolio"]) => <MPortfolio c={c} /> },
  videos: { classic: (c: PageContentMap["videos"], _s, v) => <ClassicVideosPage c={c} videos={v} />, modern: (c: PageContentMap["videos"], _s, v) => <MVideos c={c} videos={v} /> },
  about: { classic: (c: PageContentMap["about"]) => <About c={c} />, modern: (c: PageContentMap["about"]) => <MAbout c={c} />, igClass: "inner gap-top" },
  contact: { classic: (c: PageContentMap["contact"], site) => <Contact c={c} site={site} />, modern: (c: PageContentMap["contact"], site) => <MContact c={c} site={site} /> },
  "the-tplum-signature": { classic: (c: PageContentMap["the-tplum-signature"]) => <Signature c={c} />, modern: (c: PageContentMap["the-tplum-signature"]) => <MSignature c={c} /> },
  faq: { classic: (c: PageContentMap["faq"], site) => <Faq c={c} site={site} />, modern: (c: PageContentMap["faq"], site) => <MFaq c={c} site={site} /> },
  "coming-soon": { classic: (c: PageContentMap["coming-soon"]) => <ComingSoon c={c} />, modern: (c: PageContentMap["coming-soon"]) => <ComingSoon c={c} />, bare: true },
  book: { classic: (c: PageContentMap["book"]) => <Book c={c} />, modern: (c: PageContentMap["book"]) => <MBook c={c} /> },
};
