/**
 * Brand preloader, after PairMediaPro: a black screen with the white Tplum logo breathing.
 * It is part of every page's HTML so it covers the very first paint of a visit, then fades out when `html.pl-ready` is set:
 * by the layout once the page has hydrated, or by the 4-second failsafe in the head, whatever happens.
 */
export const releasePreloader = () => {
  if (typeof document === "undefined") return;
  const done = () => document.documentElement.classList.add("pl-ready");
  // wait for the fonts so the page doesn't jump as the preloader lifts (but never longer than the failsafe)
  if (document.fonts?.ready) document.fonts.ready.then(done, done);
  else done();
};

/**
 * Runs in <head> before the first paint. The preloader shows once per visit: the first page of a visit marks the
 * browser tab (sessionStorage), and every later page (or a refresh) skips it straight away (`pl-skip`).
 * A new visit (a new tab, or the browser reopened) shows it again. If storage is blocked, it shows as before.
 * The 4-second failsafe lifts it whatever happens.
 */
export const PRELOADER_FAILSAFE =
  "(function(){var d=document.documentElement;try{if(sessionStorage.getItem('tplum-pl')){d.classList.add('pl-ready','pl-skip');return}sessionStorage.setItem('tplum-pl','1')}catch(e){}setTimeout(function(){d.classList.add('pl-ready')},4000)})()";

export function BootPreloader() {
  return (
    <div className="m-preloader" role="status" aria-label="Loading">
      <img src="/brand/tplum-logo-white.png" alt="" width={120} height={67} />
    </div>
  );
}
