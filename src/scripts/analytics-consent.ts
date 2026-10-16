export {};
const measurementId = 'G-4SXX4F51YF';
const storageKey = 'analytics-consent-v1';
const gaWindow = window as typeof window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  [key: `ga-disable-${string}`]: boolean;
};
const banner = document.querySelector<HTMLElement>('#analytics-consent')!;
const settings = document.querySelector<HTMLButtonElement>('#privacy-settings')!;
const close = document.querySelector<HTMLButtonElement>('#analytics-close')!;
let choice: string | null = null;
try { choice = localStorage.getItem(storageKey); } catch { /* Default to no analytics. */ }
let loaded = false;
function enable() {
  gaWindow[`ga-disable-${measurementId}`] = false;
  if (loaded) return;
  loaded = true;
  gaWindow.dataLayer = gaWindow.dataLayer || [];
  gaWindow.gtag = function () { gaWindow.dataLayer!.push(arguments); };
  gaWindow.gtag('js', new Date());
  gaWindow.gtag('config', measurementId, { allow_google_signals: false, allow_ad_personalization_signals: false });
  const script = document.createElement('script');
  script.id = 'google-analytics';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.append(script);
}
function disable() {
  gaWindow[`ga-disable-${measurementId}`] = true;
  // Remove GA cookies at host and parent-domain scopes, including path scopes.
  const domains = location.hostname.split('.');
  const paths = location.pathname.split('/');
  const scopes = new Set(['/']);
  while (paths.length) { scopes.add(paths.join('/') || '/'); paths.pop(); }
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.trim().split('=')[0];
    if (!/^_ga(?:_|$)|^_gid$|^_gat(?:_|$)/.test(name)) continue;
    for (const path of scopes) {
      document.cookie = `${name}=; Max-Age=0; path=${path}`;
      for (let i = 0; i < domains.length; i++) {
        document.cookie = `${name}=; Max-Age=0; path=${path}; domain=${domains.slice(i).join('.')}`;
      }
    }
  }
}
function save(value: 'accepted' | 'rejected') {
  choice = value;
  try { localStorage.setItem(storageKey, value); } catch { /* Choice lasts for this page only. */ }
  if (value === 'accepted') enable(); else disable();
  banner.hidden = true;
  settings.focus();
  // Unload all running Google code when consent is withdrawn.
  if (value === 'rejected' && loaded) location.reload();
}
settings.hidden = false;
settings.addEventListener('click', () => {
  banner.hidden = false;
  close.hidden = choice !== 'accepted' && choice !== 'rejected';
  document.querySelector('#consent-status')!.textContent = choice === 'accepted' ? 'Analitika je uključena. Odabirom „Odbij“ povlačite pristanak.' : 'Analitika je isključena.';
  document.querySelector<HTMLButtonElement>('#analytics-accept')!.focus();
});
close.addEventListener('click', () => { banner.hidden = true; settings.focus(); });
document.querySelector('#analytics-accept')!.addEventListener('click', () => save('accepted'));
document.querySelector('#analytics-reject')!.addEventListener('click', () => save('rejected'));
window.addEventListener('storage', (event) => {
  if (event.key === storageKey || event.key === null) location.reload();
});
if (choice === 'accepted') enable();
else { disable(); banner.hidden = choice === 'rejected'; }
