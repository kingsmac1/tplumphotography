/**
 * Brand preloader (modern design only), after PairMediaPro: a black screen with the white Tplum logo breathing.
 * It is part of every page's HTML so it covers the very first paint, then fades out when `html.pl-ready` is set:
 * by the layout once the page has hydrated, or by the 4-second failsafe in the head, whatever happens.
 * Classic design: hidden by CSS (modern.css only shows it under html.design-modern).
 */
export const releasePreloader = () => {
  if (typeof document === "undefined") return;
  const done = () => document.documentElement.classList.add("pl-ready");
  // wait for the fonts so the page doesn't jump as the preloader lifts (but never longer than the failsafe)
  if (document.fonts?.ready) document.fonts.ready.then(done, done);
  else done();
};

export const PRELOADER_FAILSAFE = "setTimeout(function(){document.documentElement.classList.add('pl-ready')},4000)";

export function BootPreloader() {
  return (
    <div className="m-preloader" role="status" aria-label="Loading">
      <img src="/brand/tplum-logo-white.png" alt="" width={120} height={67} />
    </div>
  );
}
