/* views/account.js — profile, wishlist, my orders, order tracking, notifications */
import { icon } from '../icons.js';
import { t, lang } from '../i18n.js';
import { esc, $, $$, money, dateFmt, V } from '../utils.js';
import { db } from '../db.js';
import { session } from '../session.js';
import { cart, wish } from '../cart.js';
import { auth, authError } from '../auth.js';
import { toast, productCard, emptyState, statusPill, orderTimeline, confirmDialog, revealInit } from '../ui.js';

const acctNav = (active) => `
<div class="acct-layout">
  <nav class="acct-nav">
    <a href="#/profile" class="${active === 'profile' ? 'active' : ''}">${icon('user')}${esc(t('nav.profile'))}</a>
    <a href="#/orders" class="${active === 'orders' ? 'active' : ''}">${icon('box')}${esc(t('orders.title'))}</a>
    <a href="#/wishlist" class="${active === 'wishlist' ? 'active' : ''}">${icon('heart')}${esc(t('nav.wishlist'))}</a>
    <a href="#/notifications" class="${active === 'notifs' ? 'active' : ''}">${icon('bell')}${esc(t('notif.title'))}</a>
    <a href="#/track" class="${active === 'track' ? 'active' : ''}">${icon('search')}${esc(t('nav.track'))}</a>
  </nav>
  <div id="acct-content"></div>
</div>`;

/* ================================================================ PROFILE */
export const profileView = {
  titleKey: 'profile.title',
  async render(app) {
    app.innerHTML = `<div class="container"><div class="page-head"><h1>${esc(t('profile.title'))}</h1></div>${acctNav('profile')}</div>`;
    const box = $('#acct-content');
    const p = session.profile || {};
    const orders = await db.orders.mine().catch(() => []);
    box.innerHTML = `
    <div class="stat-cards" style="margin-bottom:24px">
      <div class="stat-card"><div class="sc-icon">${icon('user')}</div><b>${esc(session.displayName || session.email || '')}</b>
        <span>${esc(session.email || '')} ${session.emailVerified ? '✓' : '· unverified'}</span></div>
      <div class="stat-card"><div class="sc-icon">${icon('box')}</div><b>${orders.length}</b><span>${esc(t('profile.ordersCount'))}</span></div>
      <div class="stat-card"><div class="sc-icon">${icon('heart')}</div><b>${wish.ids().length}</b><span>${esc(t('profile.wishlistCount'))}</span></div>
      <div class="stat-card"><div class="sc-icon">${icon('calendar')}</div><b style="font-size:1rem">${esc(dateFmt(p.createdAt || Date.now(), lang()))}</b><span>${esc(t('profile.memberSince'))}</span></div>
    </div>
    <div class="panel">
      <h3>${icon('user')}${esc(t('profile.info'))}</h3>
      <div class="form-grid">
        <div class="field"><label>${esc(t('auth.fullName'))}</label><input class="input" id="pf-name" value="${esc(session.displayName || p.displayName || '')}" /></div>
        <div class="field"><label>${esc(t('auth.phone'))}</label><input class="input" id="pf-phone" value="${esc(p.phone || '')}" /></div>
        <div class="field"><label>${esc(t('auth.country'))}</label><input class="input" id="pf-country" value="${esc(p.country || '')}" /></div>
        <div class="field"><label>${esc(t('auth.email'))}</label><input class="input" value="${esc(session.email || '')}" disabled /></div>
      </div>
      <button class="btn btn--primary" id="pf-save">${icon('check')}${esc(t('common.save'))}</button>
    </div>
    <div class="panel">
      <h3>${icon('lock')}${esc(t('profile.security'))}</h3>
      <form id="pw-form" novalidate>
        <div class="form-grid">
          <div class="field"><label>${esc(t('auth.password'))}</label><input class="input" id="pw-cur" type="password" autocomplete="current-password" required /></div>
          <div class="field"><label>${esc(t('profile.changePw'))}</label><input class="input" id="pw-new" type="password" autocomplete="new-password" required />
            <span class="field-hint">${esc(t('auth.pwHint'))}</span></div>
        </div>
        <button class="btn btn--ghost" type="submit">${icon('lock')}${esc(t('profile.changePw'))}</button>
      </form>
    </div>`;

    $('#pf-save').onclick = async () => {
      const name = $('#pf-name').value.trim(), phone = $('#pf-phone').value.trim(), country = $('#pf-country').value.trim();
      if (!V.name(name)) return toast(t('auth.fullName'), 'error');
      if (phone && !V.phone(phone)) return toast(t('auth.phone'), 'error');
      await db.users.save(session.uid, { displayName: name, phone, country });
      await auth.refresh();
      window.dispatchEvent(new CustomEvent('etsy:auth'));
      toast(t('profile.saved'), 'success');
    };
    $('#pw-form').onsubmit = async e => {
      e.preventDefault();
      const cur = $('#pw-cur').value, nw = $('#pw-new').value;
      if (!V.password(nw)) return toast(t('auth.pwHint'), 'error');
      try { await auth.changePassword(cur, nw); toast(t('profile.pwChanged'), 'success'); e.target.reset(); }
      catch (err) { toast(authError(err), 'error'); }
    };
  },
};

/* =============================================================== WISHLIST */
export const wishlistView = {
  titleKey: 'wishlist.title',
  async render(app) {
    app.innerHTML = `<div class="container"><div class="page-head"><h1>${esc(t('wishlist.title'))}</h1></div>${acctNav('wishlist')}</div>`;
    const box = $('#acct-content');
    box.innerHTML = '<div class="spinner"></div>';
    const ids = wish.ids();
    const all = await db.products.list({ sort: 'newest' });
    const items = ids.map(id => all.find(p => p.id === id)).filter(Boolean);
    box.innerHTML = items.length
      ? `<div class="grid grid--products">${items.map(productCard).join('')}</div>`
      : '';
    if (!items.length) box.append(emptyState({ ic: 'heart', title: t('wishlist.empty'), text: t('wishlist.emptyHint'), ctaLabel: t('cart.browse'), ctaHref: '#/catalog' }));
    revealInit(box);
  },
};

/* ============================================================= MY ORDERS */
export const ordersView = {
  titleKey: 'orders.title',
  async render(app) {
    app.innerHTML = `<div class="container"><div class="page-head"><h1>${esc(t('orders.title'))}</h1></div>${acctNav('orders')}</div>`;
    const box = $('#acct-content');
    box.innerHTML = '<div class="spinner"></div>';
    const orders = await db.orders.mine().catch(() => []);
    if (!orders.length) { box.innerHTML = ''; box.append(emptyState({ ic: 'box', title: t('orders.empty'), text: t('orders.emptyHint'), ctaLabel: t('cart.browse'), ctaHref: '#/catalog' })); return; }
    box.innerHTML = `
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>${esc(t('orders.number'))}</th><th>${esc(t('common.date'))}</th><th>${esc(t('orders.items'))}</th><th>${esc(t('common.total'))}</th><th>${esc(t('common.status'))}</th><th></th></tr></thead>
      <tbody>${orders.map(o => `
        <tr>
          <td class="mono">${esc(o.orderNumber)}</td>
          <td>${esc(dateFmt(o.createdAt, lang()))}</td>
          <td>${o.items.map(i => esc(i.name)).join(', ').slice(0, 60)}${o.items.length > 1 ? '…' : ''}</td>
          <td><b>${money(o.total, lang())}</b></td>
          <td>${statusPill(o.status)}</td>
          <td><a class="btn btn--sm btn--ghost" href="#/order/${esc(o.id)}">${esc(t('common.continue'))} →</a></td>
        </tr>`).join('')}</tbody>
    </table></div>`;
  },
};

/* =========================================================== ORDER DETAIL */
export const orderView = {
  async render(app, params) {
    const order = await db.orders.get(params.id);
    if (!order) { app.innerHTML = `<div class="container section"></div>`; app.append(emptyState({ ic: 'box', title: t('track.notFound'), text: t('track.lead'), ctaLabel: t('nav.orders'), ctaHref: '#/orders' })); return; }
      document.title = `Legendar — ${order.orderNumber}`;
    const canReceipt = ['awaiting_payment', 'rejected'].includes(order.status);
    const canCancel = ['awaiting_payment', 'under_review', 'rejected'].includes(order.status);
    app.innerHTML = `
    <div class="container">
      <div class="page-head" style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:14px">
        <div><h1 class="mono" style="font-size:1.5rem">${esc(order.orderNumber)}</h1>
          <p class="lead">${esc(dateFmt(order.createdAt, lang()))} · ${money(order.total, lang())}</p></div>
        ${statusPill(order.status)}
      </div>
      ${order.status === 'rejected' ? `<div class="alert alert--error">${icon('alert')}<span>${esc(t('orders.rejectedNote'))}${order.rejectReason ? ' — ' + esc(order.rejectReason) : ''}</span></div>` : ''}
      <div class="checkout-layout" style="margin-top:26px">
        <div>
          <div class="panel">
            <h3>${icon('activity')}${esc(t('orders.timelineTitle'))}</h3>
            ${orderTimeline(order)}
            ${canReceipt ? `<a class="btn btn--primary" style="margin-top:8px" href="${order.status === 'awaiting_payment' ? '#/pay/' + esc(order.id) : '#/receipt/' + esc(order.id)}">${icon('upload')}${esc(order.status === 'awaiting_payment' ? t('checkout.next') : t('orders.uploadReceipt'))}</a>` : ''}
          </div>
          ${order.deliveryNote && ['delivering', 'delivered'].includes(order.status) ? `
          <div class="panel"><h3>${icon('download')}${esc(t('orders.deliveryNote'))}</h3>
            <p class="muted" style="font-size:.92rem">${esc(order.deliveryNote)}</p></div>` : ''}
          ${order.receiptName ? `<div class="panel"><h3>${icon('receipt')}${esc(t('orders.uploadReceipt'))}</h3>
            <p class="muted">${esc(order.receiptName)} · ${esc(dateFmt(order.receiptAt, lang()))}</p>
            <div id="receipt-view-slot"></div></div>` : ''}
        </div>
        <div>
          <div class="panel">
            <h3>${icon('cart')}${esc(t('orders.items'))}</h3>
            ${order.items.map(i => `<div class="sumline"><span>${esc(i.name)} ×${i.qty}</span><b>${money(i.price * i.qty, lang())}</b></div>`).join('')}
            ${order.discount ? `<div class="sumline discount"><span>${esc(t('cart.discount'))}</span><b>−${money(order.discount, lang())}</b></div>` : ''}
            <div class="sumline total"><span>${esc(t('common.total'))}</span><span>${money(order.total, lang())}</span></div>
          </div>
          <div class="panel"><h3>${icon('user')}${esc(t('checkout.contactInfo'))}</h3>
            <div class="sumline"><span>${esc(t('auth.fullName'))}</span><b>${esc(order.customer?.name || '')}</b></div>
            <div class="sumline"><span>${esc(t('auth.email'))}</span><b>${esc(order.customer?.email || '')}</b></div>
            <div class="sumline"><span>${esc(t('auth.phone'))}</span><b>${esc(order.customer?.phone || '')}</b></div>
            <div class="sumline"><span>${esc(t('auth.country'))}</span><b>${esc(order.customer?.country || '')}</b></div>
          </div>
          ${canCancel ? `<button class="btn btn--danger btn--block" id="ord-cancel">${icon('x')}${esc(t('orders.cancel'))}</button>` : ''}
        </div>
      </div>
    </div>`;
    $('#ord-cancel')?.addEventListener('click', async () => {
      if (!(await confirmDialog(t('common.confirm')))) return;
      try { await db.orders.cancel(order.id); toast(t('st.cancelled'), 'info'); orderView.render(app, params); }
      catch (e) { toast(e.message || t('common.error'), 'error'); }
    });
    if (order.receiptName) {
      const slot = $('#receipt-view-slot');
      const url = await db.storage.receiptUrl(order);
      if (url) slot.innerHTML = `<img src="${esc(url)}" alt="receipt" style="border-radius:12px;border:1px solid var(--border);margin-top:10px" />`;
    }
    revealInit(app);
  },
};

/* ================================================================= TRACK */
export const trackView = {
  titleKey: 'track.title',
  async render(app, params, query) {
    app.innerHTML = `
    <div class="container">
      <div class="page-head"><h1>${esc(t('track.title'))}</h1><p class="lead">${esc(t('track.lead'))}</p></div>
      ${acctNav('track')}
      <div id="track-slot" style="margin-top:26px"></div>
    </div>`;
    const slot = $('#track-slot');
    async function find(num) {
      const orders = await db.orders.mine().catch(() => []);
      const o = orders.find(x => x.orderNumber.toUpperCase() === num.toUpperCase());
      if (!o) { return null; }
      return o.id;
    }
    if (query.num) {
      const id = await find(query.num);
      if (id) { location.hash = `#/order/${id}`; return; }
      slot.innerHTML = `<div class="alert alert--error">${icon('alert')}<span>${esc(t('track.notFound'))}</span></div>`;
    }
    const form = document.createElement('form');
    form.className = 'searchbar'; form.style.maxWidth = '480px';
      form.innerHTML = `${icon('search')}<input class="input" id="track-num" placeholder="LEGENDAR-XXXXXXXX" value="${esc(query.num || '')}" aria-label="${esc(t('track.title'))}" />`;
    const btn = document.createElement('button');
    btn.className = 'btn btn--primary'; btn.textContent = t('track.btn');
    form.append(btn);
    form.onsubmit = async e => {
      e.preventDefault();
      const v = $('#track-num').value.trim().toUpperCase();
      if (!v) return;
      const id = await find(v);
      if (id) location.hash = `#/order/${id}`;
      else { slot.innerHTML = `<div class="alert alert--error" style="margin-top:20px">${icon('alert')}<span>${esc(t('track.notFound'))}</span></div>`; }
    };
    slot.prepend(form);
  },
};

/* ========================================================= NOTIFICATIONS */
export const notifsView = {
  titleKey: 'notif.title',
  async render(app) {
    app.innerHTML = `<div class="container"><div class="page-head"><h1>${esc(t('notif.title'))}</h1></div>${acctNav('notifs')}</div>`;
    const box = $('#acct-content');
    const list = await db.notifications.list().catch(() => []);
    const markBtn = document.createElement('button');
    markBtn.className = 'btn btn--ghost btn--sm'; markBtn.style.marginBottom = '16px';
    markBtn.innerHTML = `${icon('check')}${esc(t('notif.markRead'))}`;
    markBtn.onclick = async () => { await db.notifications.markAll(); notifsView.render(app); window.dispatchEvent(new CustomEvent('etsy:notifs')); };
    box.innerHTML = '';
    box.append(markBtn);
    if (!list.length) { box.append(emptyState({ ic: 'bell', title: t('notif.empty'), text: t('notif.emptyHint') })); return; }
    const wrap = document.createElement('div');
    wrap.innerHTML = list.map(n => `
      <div class="notif-item${n.isRead ? '' : ' unread'}">
        <span class="ni-icon">${icon('bell')}</span>
        <div><p>${esc(t(n.text, n.params || {}))}</p><time>${esc(dateFmt(n.at, lang()))}</time></div>
      </div>`).join('');
    box.append(wrap);
  },
};
