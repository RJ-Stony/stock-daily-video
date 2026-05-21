// fonts.googleapis.com / fonts.gstatic.com are blocked in the cloud environment.
// @remotion/google-fonts fetches from those CDNs at render time → blocked.
// Solution: import fontsource CSS files (webpack bundles the WOFF2 files locally).
// No delayRender needed — Remotion waits for the page to stabilize before
// capturing frames, and localhost font files load in milliseconds.
import '@fontsource/inter/latin.css';
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/500.css';
import '@fontsource/noto-sans-kr/700.css';

export function loadLocalFonts(): void {
  // CSS imports above register @font-face rules pointing to webpack-bundled WOFF2 files.
  // No explicit font loading is needed — fonts load on first use from localhost.
}
