/* ============================================================================
 * ui.js — shared UI components: header, footer, toasts, modals, product cards,
 * skeletons, empty states, status pills, timeline, notifications, WhatsApp FAB.
 * ==========================================================================*/
import { icon } from './icons.js';
import { t, lang, setLang, LANGS } from './i18n.js';
import { esc, $, $$, money, dateFmt } from './utils.js';
import { session } from './session.js';
import { cart, wish } from './cart.js';
import { db } from './db.js';
import { BRAND, isAdobeProduct } from './config.js';

/* ------------------------------------------------------------------ Toasts */
export function toast(msg, type = 'info', ms = 3800) {
  const root = $('#toast-root'); if (!root) return;
  const ic = { success: 'checkCircle', error: 'alert', warning: 'warning', info: 'info' }[type] || 'info';
  const node = document.createElement('div');
  node.className = `toast toast--${type}`;
  node.innerHTML = `${icon(ic)}<div>${msg}</div><button class="t-close" aria-label="${esc(t('common.close'))}">${icon('x')}</button>`;
  node.querySelector('.t-close').onclick = () => node.remove();
  root.append(node);
  setTimeout(() => node.remove(), ms);
}

/* ------------------------------------------------------------------ Modals */
export function openModal({ title, sub, body, actions = [], wide = false }) {
  closeModals();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal${wide ? ' modal--wide' : ''}" role="dialog" aria-modal="true">
    <h3>${esc(title)}</h3>${sub ? `<p class="m-sub">${esc(sub)}</p>` : ''}
    <div class="m-body"></div><div class="modal-actions"></div></div>`;
  if (typeof body === 'string') backdrop.querySelector('.m-body').innerHTML = body;
  else if (body) backdrop.querySelector('.m-body').append(body);
  const actWrap = backdrop.querySelector('.modal-actions');
  for (const a of actions) {
    const b = document.createElement('button');
    b.className = `btn ${a.class || 'btn--ghost'}`;
    b.textContent = a.label;
    b.onclick = async () => { try { await a.onClick?.(backdrop); } catch (e) { console.error(e); } };
    actWrap.append(b);
  }
  backdrop.addEventListener('mousedown', e => { if (e.target === backdrop && !actions.some(a => a.keepOpen)) closeModals(); });
  $('#modal-root').append(backdrop);
  return backdrop;
}
export function closeModals() { $('#modal-root').innerHTML = ''; }

export function confirmDialog(message, { danger = true, okLabel } = {}) {
  return new Promise(resolve => {
    const m = openModal({
      title: t('common.confirm'), sub: message,
      actions: [
        { label: t('common.cancel'), class: 'btn--ghost', onClick: () => { closeModals(); resolve(false); } },
        { label: okLabel || t('common.yes'), class: danger ? 'btn--danger' : 'btn--primary', onClick: () => { closeModals(); resolve(true); } },
      ],
    });
    m.addEventListener('mousedown', e => { if (e.target === m) resolve(false); });
  });
}

/* ------------------------------------------------------- Small components */
export const catLabel = (c) => c ? (c[`name${{ en: '', fr: 'Fr', ar: 'Ar' }[lang()] || ''}`] || c.name) : '';

export function statusPill(status) {
  return `<span class="status-pill st-${esc(status)}"><span class="dot"></span>${esc(t('st.' + status))}</span>`;
}

export function starsRow(rating, count) {
  const full = Math.round(rating || 0);
  let s = '<span class="stars">';
  for (let i = 1; i <= 5; i++) s += icon(i <= full ? 'star' : 'starO');
  s += `</span>${count != null ? ` <span class="faint">(${count})</span>` : ''}`;
  return s;
}

export function emptyState({ ic = 'box', title, text, ctaLabel, ctaHref, onCta }) {
  const wrap = document.createElement('div');
  wrap.className = 'empty-state';
  wrap.innerHTML = `<div class="es-icon">${icon(ic)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>`;
  if (ctaLabel) {
    const b = document.createElement('a');
    b.className = 'btn btn--primary'; b.href = ctaHref || '#/'; b.textContent = ctaLabel;
    if (onCta) b.addEventListener('click', onCta);
    wrap.append(b);
  }
  return wrap;
}

export function skeletonGrid(n = 8) {
  let s = '<div class="grid grid--products">';
  for (let i = 0; i < n; i++) s += `<div class="sk-card"><div class="skeleton sk-media"></div><div class="skeleton sk-line sk-line--w60"></div><div class="skeleton sk-line sk-line--w80"></div><div class="skeleton sk-line sk-line--w40" style="margin-bottom:16px"></div></div>`;
  return s + '</div>';
}

export function productCard(p) {
  const img = p.images && p.images[0];
  const adobeProduct = isAdobeProduct(p);
  const whatsappHref = `https://wa.me/${BRAND.whatsappNumber}?text=${encodeURIComponent('Hello Legendar, I want to ask about: ' + p.name)}`;
  const tags = [
    p.demo ? `<span class="tag tag--demo">DEMO</span>` : '',
    p.popular ? `<span class="tag tag--hot">HOT</span>` : '',
    p.stock === false ? `<span class="tag tag--out">${esc(t('common.outOfStock'))}</span>` : '',
  ].join('');
  return `
  <article class="p-card reveal">
    <a class="p-media" href="#/product/${esc(p.id)}" aria-label="${esc(p.name)}">
      ${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy" width="640" height="420" />` : ''}
      <span class="p-tags">${tags}</span>
    </a>
    <button class="p-wish${wish.has(p.id) ? ' on' : ''}" data-wish="${esc(p.id)}" aria-label="wishlist" title="${esc(t('nav.wishlist'))}">${icon('heart')}</button>
    <div class="p-body">
      <span class="p-cat">${esc(p.vendor || catLabel({ name: p.cat }))}</span>
      <h3><a href="#/product/${esc(p.id)}">${esc(p.name)}</a></h3>
      <p class="p-desc">${esc(p.desc || '')}</p>
      <div class="p-foot">
        <div class="p-price">
          ${adobeProduct ? `<span class="contact-price">${icon('whatsapp')} WhatsApp</span>` : `${p.compareAt && p.compareAt > p.price ? `<span class="strike">${money(p.compareAt, lang())}</span>` : ''}${money(p.price, lang())}<small> ${esc(BRAND.currency)}</small>`}
        </div>
        ${adobeProduct
          ? `<a class="btn btn--sm btn--whatsapp" href="${whatsappHref}" target="_blank" rel="noopener">${icon('whatsapp')}<span>WhatsApp</span></a>`
          : p.stock === false
          ? `<span class="btn btn--sm" style="opacity:.5">${esc(t('common.outOfStock'))}</span>`
          : `<button class="btn--buy" data-buy="${esc(p.id)}">${icon('cart')}<span>${esc(t('common.addToCart'))}</span></button>`}
      </div>
    </div>
  </article>`;
}

export function orderTimeline(order) {
  const events = order.timeline || [];
  const flow = ['created', 'receipt', 'paid', 'delivering', 'delivered'];
  const idx = flow.indexOf(events[events.length - 1]?.status);
  return `<div class="timeline">${events.map((e, i) => `
    <div class="tl-item${i < events.length - 1 ? ' done' : (idx >= 0 && idx < flow.length - 1) ? ' current' : ' done'}">
      <b>${esc(t('st.' + (e.status === 'created' ? 'awaiting_payment' : e.status === 'receipt' ? 'under_review' : e.status)) || e.status)}</b>
      <time>${esc(dateFmt(e.at, lang()))}</time>
      ${e.note && ['rejected', 'delivering', 'delivered'].includes(e.status) ? `<p>${esc(e.note)}</p>` : ''}
      ${e.status === 'created' ? `<p>${esc(t('tl.createdD'))}</p>` : ''}
      ${e.status === 'receipt' ? `<p>${esc(t('tl.receiptD'))}</p>` : ''}
      ${e.status === 'paid' ? `<p>${esc(t('tl.paidD'))}</p>` : ''}
    </div>`).join('')}</div>`;
}

/* ------------------------------------------------------------ Notifications */
let notifCache = [];
async function refreshNotifBadge() {
  const n = $('#notif-count'); if (!n) return;
  if (!session.loggedIn) { n.hidden = true; return; }
  const c = await db.notifications.unreadCount().catch(() => 0);
  n.hidden = c === 0; n.textContent = c > 9 ? '9+' : String(c);
}
export function pollNotifs() {
  refreshNotifBadge();
  window.addEventListener('etsy:notifs', refreshNotifBadge);
  session.onChange(() => refreshNotifBadge());
}

async function notifDropdown(host) {
  const dd = document.createElement('div');
  dd.className = 'dropdown';
  dd.innerHTML = `<div class="dd-head">${esc(t('notif.title'))}</div><div class="dd-list" style="max-height:330px;overflow:auto"><div class="spinner" style="margin:14px auto"></div></div>
    <button class="notif-markall">${esc(t('notif.markRead'))}</button>`;
  host.append(dd);
  notifCache = await db.notifications.list().catch(() => []);
  const list = dd.querySelector('.dd-list');
  if (!notifCache.length) {
    list.innerHTML = `<p class="faint" style="padding:14px;text-align:center">${esc(t('notif.empty'))}<br><small>${esc(t('notif.emptyHint'))}</small></p>`;
  } else {
    list.innerHTML = notifCache.slice(0, 8).map(n => `
      <a href="#/notifications" class="notif-drop-item${n.isRead ? '' : ' unread-l'}" style="padding:10px 13px;border-radius:10px;${n.isRead ? '' : 'background:rgba(139,92,246,.08)'}">
        <div>${icon('bell')}</div><div><p style="font-size:.85rem">${esc(t(n.text, n.params || {}))}</p><time style="font-size:.72rem;color:var(--text-3)">${esc(dateFmt(n.at, lang()))}</time></div>
      </a>`).join('');
  }
  dd.querySelector('.notif-markall').onclick = async () => { await db.notifications.markAll().catch(() => {}); refreshNotifBadge(); dd.remove(); };
  setTimeout(() => document.addEventListener('click', function h(e) { if (!dd.contains(e.target)) { dd.remove(); document.removeEventListener('click', h); } }), 10);
}

/* ----------------------------------------------------------------- Header */
export function renderHeader() {
  const header = $('#app-header');
  header.innerHTML = `
  <div class="container header-inner">
    <button class="icon-btn nav-toggle" aria-label="menu">${icon('menu')}</button>
    <a class="logo" href="#/" aria-label="Legendar home"><span class="logo-mark logo-mark--brand"><img src="assets/brand-logo.jfif" alt="Legendar" /></span><span>Legendar<small>PREMIUM SOFTWARE</small></span></a>
    <nav class="nav" id="main-nav">
      <a href="#/catalog" data-route="catalog">${esc(t('nav.catalog'))}</a>
      <a href="#/category/adobe" data-route="adobe">${esc(t('nav.adobe'))}</a>
      <a href="#/category/engineering" data-route="engineering">${esc(t('nav.engineering'))}</a>
      <a href="#/faq">${esc(t('nav.faq'))}</a>
      <a href="#/contact">${esc(t('nav.contact'))}</a>
    </nav>
    <form class="searchbar" role="search" id="nav-search">
      ${icon('search')}
      <input class="input" type="search" id="nav-search-input" placeholder="${esc(t('nav.search'))}" aria-label="${esc(t('common.search'))}" />
      <kbd>/</kbd>
    </form>
    <div class="header-actions">
      <div class="lang-switch" role="group" aria-label="language">
        ${Object.keys(LANGS).map(l => `<button data-lang="${l}" class="${l === lang() ? 'on' : ''}" aria-label="${LANGS[l]}">${l.toUpperCase()}</button>`).join('')}
      </div>
      <button class="icon-btn" id="wish-btn" aria-label="${esc(t('nav.wishlist'))}" title="${esc(t('nav.wishlist'))}">${icon('heart')}</button>
      <button class="icon-btn" id="cart-btn" aria-label="${esc(t('nav.cart'))}" title="${esc(t('nav.cart'))}">${icon('cart')}<span class="badge-count" id="cart-count" hidden></span></button>
      <button class="icon-btn" id="bell-btn" aria-label="${esc(t('nav.notifications'))}" hidden>${icon('bell')}<span class="badge-count" id="notif-count" hidden></span></button>
      <span id="user-slot"></span>
    </div>
  </div>
  <div class="drawer-backdrop" id="drawer-backdrop"></div>
  <aside class="drawer" id="drawer" aria-label="navigation">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <a class="logo" href="#/"><span class="logo-mark logo-mark--brand"><img src="assets/brand-logo.jfif" alt="Legendar" /></span><span>Legendar</span></a>
      <button class="icon-btn" id="drawer-close">${icon('x')}</button>
    </div>
    <nav class="nav-d">
      <a href="#/">${icon('home')}${esc(t('nav.home'))}</a>
      <a href="#/catalog">${icon('grid')}${esc(t('nav.catalog'))}</a>
      <a href="#/category/adobe">${icon('layers')}${esc(t('nav.adobe'))}</a>
      <a href="#/category/engineering">${icon('code')}${esc(t('nav.engineering'))}</a>
      <a href="#/track">${icon('box')}${esc(t('nav.track'))}</a>
      <a href="#/faq">${icon('question')}${esc(t('nav.faq'))}</a>
      <a href="#/contact">${icon('message')}${esc(t('nav.contact'))}</a>
    </nav>
  </aside>`;

  /* interactions */
  const drawer = $('#drawer'), backdrop = $('#drawer-backdrop');
  $('#app-header .nav-toggle').onclick = () => { drawer.classList.add('open'); backdrop.classList.add('open'); };
  $('#drawer-close').onclick = backdrop.onclick = () => { drawer.classList.remove('open'); backdrop.classList.remove('open'); };
  drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { drawer.classList.remove('open'); backdrop.classList.remove('open'); }));

  $('#nav-search').addEventListener('submit', e => {
    e.preventDefault();
    const q = $('#nav-search-input').value.trim();
    if (q) location.hash = `#/search?q=${encodeURIComponent(q)}`;
  });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) {
      e.preventDefault(); $('#nav-search-input')?.focus();
    }
  });

  header.querySelectorAll('.lang-switch button').forEach(b => b.onclick = () => {
    setLang(b.dataset.lang);
    window.dispatchEvent(new CustomEvent('etsy:lang'));
  });

  $('#wish-btn').onclick = () => location.hash = session.loggedIn ? '#/wishlist' : '#/login?redirect=%23/wishlist';
  $('#cart-btn').onclick = () => location.hash = '#/cart';
  $('#bell-btn').onclick = e => { e.stopPropagation(); notifDropdown($('#bell-btn').parentElement); };

  refreshUserSlot(); refreshCartBadge(); refreshNotifBadge();
  markActiveNav();
}

export function markActiveNav() {
  const hash = location.hash || '#/';
  $$('#main-nav a').forEach(a => {
    a.classList.toggle('active',
      a.dataset.route === 'catalog' ? hash.startsWith('#/catalog') || hash.startsWith('#/search') :
      a.dataset.route === 'adobe' ? hash.startsWith('#/category/adobe') :
      a.dataset.route === 'engineering' ? hash.startsWith('#/category/engineering') :
      hash === a.getAttribute('href'));
  });
}

function refreshUserSlot() {
  const slot = $('#user-slot'); if (!slot) return;
  const bell = $('#bell-btn'); if (bell) bell.hidden = !session.loggedIn;
  if (!session.loggedIn) {
    slot.innerHTML = `<a class="btn btn--ghost btn--sm" href="#/login">${esc(t('nav.login'))}</a>
                      <a class="btn btn--primary btn--sm" href="#/register">${esc(t('nav.register'))}</a>`;
    return;
  }
  const initial = (session.displayName || session.email || '?')[0].toUpperCase();
  slot.innerHTML = `<button class="user-chip" id="user-chip">
      <span class="avatar">${esc(initial)}</span>
      <span class="name">${esc(session.displayName || session.email)}</span>
      ${icon('chevronD')}
    </button>`;
  $('#user-chip').onclick = e => { e.stopPropagation(); userDropdown(slot); };
}

function userDropdown(host) {
  host.querySelectorAll('.dropdown').forEach(d => d.remove());
  const dd = document.createElement('div');
  dd.className = 'dropdown';
  dd.innerHTML = `
    <div class="dd-head">${esc(session.email || '')}${session.emailVerified ? '' : ` · <span style="color:var(--warning)">⚠ unverified</span>`}</div>
    <a href="#/profile">${icon('user')}${esc(t('nav.profile'))}</a>
    <a href="#/orders">${icon('box')}${esc(t('nav.orders'))}</a>
    <a href="#/wishlist">${icon('heart')}${esc(t('nav.wishlist'))}</a>
    <a href="#/notifications">${icon('bell')}${esc(t('nav.notifications'))}</a>
    ${session.isAdmin ? `<div class="sep"></div><a href="#/admin">${icon('dashboard')}${esc(t('nav.admin'))}</a>` : ''}
    <div class="sep"></div>
    <button id="dd-logout">${icon('logout')}${esc(t('nav.logout'))}</button>`;
  host.append(dd);
  dd.querySelector('#dd-logout').onclick = async () => {
    const { auth } = await import('./auth.js');
    await auth.logout();
    toast(t('toast.logoutOk'), 'info');
    location.hash = '#/';
    window.dispatchEvent(new CustomEvent('etsy:auth'));
  };
  setTimeout(() => document.addEventListener('click', function h(e) { if (!dd.contains(e.target) && e.target.id !== 'user-chip') { dd.remove(); document.removeEventListener('click', h); } }), 10);
}

export function refreshCartBadge() {
  const n = $('#cart-count'); if (!n) return;
  const c = cart.count();
  n.hidden = c === 0; n.textContent = String(c);
}

/* ----------------------------------------------------------------- Footer */
export function renderFooter() {
  const y = new Date().getFullYear();
  $('#app-footer').innerHTML = `
  <div class="container">
    <div class="footer-inner">
      <div class="footer-about">
    <a class="logo" href="#/"><span class="logo-mark logo-mark--brand"><img src="assets/brand-logo.jfif" alt="Legendar" /></span><span>Legendar<small>PREMIUM SOFTWARE</small></span></a>
        <p>${esc(t('home.lead')).slice(0, 150)}…</p>
        <div class="socials">
          <a class="icon-btn" href="https://wa.me/${esc(BRAND.whatsappNumber)}" target="_blank" rel="noopener" aria-label="WhatsApp">${icon('whatsapp')}</a>
          <a class="icon-btn" href="mailto:${esc(BRAND.supportEmail)}" aria-label="Email">${icon('mail')}</a>
        </div>
      </div>
      <div><h4>${esc(t('footer.shop'))}</h4><ul>
        <li><a href="#/catalog">${esc(t('nav.catalog'))}</a></li>
        <li><a href="#/category/adobe">${esc(t('nav.adobe'))}</a></li>
        <li><a href="#/category/engineering">${esc(t('nav.engineering'))}</a></li>
        <li><a href="#/cart">${esc(t('nav.cart'))}</a></li>
      </ul></div>
      <div><h4>${esc(t('footer.support'))}</h4><ul>
        <li><a href="#/contact">${esc(t('nav.contact'))}</a></li>
        <li><a href="#/faq">${esc(t('nav.faq'))}</a></li>
        <li><a href="#/track">${esc(t('nav.track'))}</a></li>
        <li><a href="https://wa.me/${esc(BRAND.whatsappNumber)}" target="_blank" rel="noopener">WhatsApp</a></li>
      </ul></div>
      <div><h4>${esc(t('footer.legal'))}</h4><ul>
        <li><a href="#/about">${esc(t('about.title'))}</a></li>
        <li><a href="#/privacy">${esc(t('privacy.title'))}</a></li>
        <li><a href="#/terms">${esc(t('terms.title'))}</a></li>
      </ul>
      <h4 style="margin-top:22px">${esc(t('footer.payments'))}</h4>
      <div class="pay-chips"><span class="pay-chip">CIH TRANSFER</span><span class="pay-chip">RIB</span><span class="pay-chip">MAD</span></div>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${y} Legendar — ${esc(t('footer.rights'))}</span>
      <span>${esc(t('footer.madeWith'))} <span class="grad-text">◆</span></span>
    </div>
  </div>`;
}

/* -------------------------------------------------- FAB / banner / reveal */
export function mountExtras() {
  if (!$('#wa-fab')) {
    const fab = document.createElement('a');
    fab.id = 'wa-fab'; fab.className = 'wa-fab';
    fab.href = `https://wa.me/${BRAND.whatsappNumber}`; fab.target = '_blank'; fab.rel = 'noopener';
    fab.setAttribute('aria-label', 'WhatsApp support');
    fab.innerHTML = icon('whatsapp');
    document.body.append(fab);
  }
  const banner = $('#demo-banner');
  if (db.mode() === 'demo') {
    banner.hidden = false;
    banner.innerHTML = `<div class="demo-banner container">${icon('info')} <strong>DEMO MODE</strong> — ${esc(t('demo.banner'))}</div>`;
  } else banner.hidden = true;
}

export function revealInit(root = document) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: .08 });
  root.querySelectorAll('.reveal:not(.in)').forEach(n => io.observe(n));
}

/* ------------------------------------------------- Global click delegation */
export function bindGlobalActions() {
  document.addEventListener('click', async e => {
    const buy = e.target.closest('[data-buy]');
    if (buy) {
      e.preventDefault();
      const p = await db.products.get(buy.dataset.buy).catch(() => null);
      if (p) { cart.add(p); toast(t('toast.cartAdd', { name: p.name }), 'success'); }
      return;
    }
    const w = e.target.closest('[data-wish]');
    if (w) {
      e.preventDefault();
      const added = wish.toggle(w.dataset.wish);
      w.classList.toggle('on', added);
      toast(t(added ? 'wishlist.added' : 'wishlist.removed'), added ? 'success' : 'info');
    }
  });
  window.addEventListener('etsy:cart', refreshCartBadge);
  window.addEventListener('etsy:auth', () => { refreshUserSlot(); refreshCartBadge(); refreshNotifBadge(); });
}
