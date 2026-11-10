import type { ComingSoonContent } from "@/cms/types";
import { Rich } from "../ui";
import { IconFacebook, IconInstagram } from "../icons";

/** Standalone page (as on WordPress): no header, footer or menu. Its social icons have no links on the original. */
export default function ComingSoon({ c }: { c: ComingSoonContent }) {
  return (
    <main className="tp-coming">
      <h1>{c.heading}</h1>
      <Rich html={c.body} className="body" />
      <div className="socials"><span aria-label="Instagram"><IconInstagram /></span><span aria-label="Facebook"><IconFacebook /></span></div>
    </main>
  );
}
