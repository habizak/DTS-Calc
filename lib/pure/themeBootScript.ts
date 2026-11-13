/**
 * Inline theme boot script. Runs before paint so the first frame matches the
 * saved theme. CSP allows it by hash, not by the per-request nonce, because a
 * service-worker-cached shell would otherwise freeze that nonce.
 * `csp.test.ts` fails when this string and the hash below diverge.
 */
export const THEME_BOOT_SCRIPT =
  '(function(){try{var m=localStorage.getItem("starter_theme");if(m!=="dark"&&m!=="light"){m=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.classList.toggle("theme-dark",m==="dark");}catch(e){}})();'
