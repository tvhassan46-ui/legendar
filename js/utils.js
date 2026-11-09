/* Shared utilities: escaping, formatting, validation, DOM helpers */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Escape untrusted strings before inserting into innerHTML (XSS protection). */
export function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;             // trusted template strings only
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}

export const money = (mad, lang = 'en') => {
  const n = Number(mad) || 0;
  const locale = lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-MA' : 'en-MA';
  try { return new Intl.NumberFormat(locale, { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 }).format(n); }
  catch { return `${n.toLocaleString()} MAD`; }
};

export const dateFmt = (ts, lang = 'en') => {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const locale = lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-FR' : 'en-GB';
  return d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
};

export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function genOrderNumber() {
  const t = Date.now().toString(36).toUpperCase().slice(-6);
  const r = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `LEGENDAR-${t}${r}`;
}

/* ------------------------------------------------------------- Validators */
export const V = {
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim()),
  phone: v => /^[+]?[\d\s().-]{7,18}$/.test(String(v).trim()),
  name:  v => String(v).trim().length >= 3 && /^[\p{L}\s'.-]+$/u.test(String(v).trim()),
  password: v => typeof v === 'string' && v.length >= 8 &&
    /[a-zA-Z]/.test(v) && /\d/.test(v),
  coupon: v => /^[A-Z0-9_-]{3,24}$/.test(String(v).trim().toUpperCase()),
  rib: v => /^[\d\s]{20,34}$/.test(String(v).trim()),
  fileSize(file, maxMB) { return file && file.size <= maxMB * 1024 * 1024; },
  fileType(file, types) { return file && types.includes(file.type); },
  safeText: v => String(v ?? '').length <= 5000 && !/<\s*script/i.test(String(v ?? '')),
};

/* ------------------------------------------------------------- Misc bits */
export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = el('textarea', { style: 'position:fixed;opacity:0' }, text);
  document.body.append(ta); ta.select();
  try { document.execCommand('copy'); } finally { ta.remove(); }
  return Promise.resolve();
}

/** Deterministic product cover art (SVG data-URI) — zero broken images, no hotlinking. */
export function coverArt(seed, label) {
  let h = 0; for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hues = [262, 232, 199, 280, 320, 160];
  const h1 = hues[h % hues.length], h2 = hues[(h >> 3) % hues.length];
  const initials = String(label || 'ET').trim().slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${h1},70%,22%)"/><stop offset="1" stop-color="hsl(${h2},80%,14%)"/>
    </linearGradient></defs>
    <rect width="640" height="420" fill="url(#g)"/>
    <g stroke="hsl(${h1},80%,70%)" stroke-opacity=".25" fill="none">
      <circle cx="560" cy="70" r="120"/><circle cx="560" cy="70" r="190"/>
      <path d="M0 340 Q160 260 320 330 T640 300"/>
      <path d="M0 380 Q160 300 320 370 T640 340" stroke-opacity=".14"/>
    </g>
    <rect x="40" y="150" width="120" height="120" rx="28" fill="hsl(${h1},75%,45%)" opacity=".85"/>
    <text x="100" y="222" text-anchor="middle" font-family="Space Grotesk,Arial" font-weight="700" font-size="46" fill="#fff">${initials}</text>
    <text x="200" y="205" font-family="Space Grotesk,Arial" font-weight="600" font-size="34" fill="rgba(255,255,255,.9)">${esc(String(label || '').slice(0, 22)).replace(/&/g,'&amp;')}</text>
    <text x="200" y="238" font-family="Inter,Arial" font-size="15" letter-spacing="4" fill="rgba(255,255,255,.45)">LEGENDAR · SOFTWARE</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function setMeta(name, content, attr = 'name') {
  let m = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!m) { m = document.createElement('meta'); m.setAttribute(attr, name); document.head.append(m); }
  m.setAttribute('content', content);
}
export function setTitles(titleKey, params) {
  // filled by i18n at runtime; imported here to avoid cycle
  import('./i18n.js').then(({ t }) => { document.title = t(titleKey, params); });
}
