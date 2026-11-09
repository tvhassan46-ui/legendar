/* router.js — hash-based SPA router (preserves the project's original architecture) */
import { t } from './i18n.js';
import { session } from './session.js';
import { setTitles, setMeta } from './utils.js';
import { markActiveNav, revealInit, toast } from './ui.js';

const routes = [];
let notFound = null;

export function route(pattern, view, opts = {}) {
  const names = [];
  const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, m => { names.push(m.slice(1)); return '([^/]+)'; }) + '$');
  routes.push({ regex, names, view, opts });
}
export function setNotFound(v) { notFound = v; }

export function parseHash() {
  const raw = (location.hash || '#/').slice(1);
  const [path, qs] = raw.split('?');
  const query = {};
  if (qs) for (const pair of qs.split('&')) { const [k, v] = pair.split('='); if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || ''); }
  return { path: '/' + path.replace(/(^\/+|\/+$)/g, ''), query };
}

async function render() {
  const { path, query } = parseHash();
  let match = null, params = {};
  for (const r of routes) {
    const m = path.match(r.regex);
    if (m) { match = r; r.names.forEach((n, i) => params[n] = decodeURIComponent(m[i + 1])); break; }
  }
  const app = document.getElementById('app');
  const view = match ? match.view : notFound;

  /* guards */
  if (match?.opts?.auth && !session.loggedIn) {
    toast(t('checkout.loginNeeded'), 'warning');
    location.hash = `#/login?redirect=${encodeURIComponent(location.hash)}`;
    return;
  }
  if (match?.opts?.admin && !session.isAdmin) {
    app.innerHTML = `<div class="container section"><div class="empty-state"><div class="es-icon" style="border-color:rgba(248,113,113,.4)"></div>
      <h3>${t('admin.needAdmin')}</h3><p>${t('auth.loginSub')}</p><a class="btn btn--primary" href="#/login">${t('nav.login')}</a></div></div>`;
    return;
  }

  window.scrollTo({ top: 0 });
  app.innerHTML = '<div class="spinner"></div>';
  try { await view.render(app, params, query); }
  catch (err) {
    console.error('[ETSY] view error:', err);
    app.innerHTML = `<div class="container section"><div class="empty-state">
      <div class="es-icon">${'<svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4m0 4h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'}</div>
      <h3>${t('common.error')}</h3><p>${String(err.message || err).slice(0, 160)}</p>
      <a class="btn btn--primary" href="#/">${t('404.btn')}</a></div></div>`;
  }
  if (view.titleKey) setTitles(view.titleKey, params);
  if (view.descKey) setMeta('description', t(view.descKey));
  markActiveNav();
  revealInit(document);
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  render();
}
