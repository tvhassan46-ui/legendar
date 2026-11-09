/* views/checkout.js — cart, checkout, order success, payment instructions, receipt upload */
import { icon } from '../icons.js';
import { t, lang } from '../i18n.js';
import { esc, $, $$, money, copyText, V, uid } from '../utils.js';
import { db } from '../db.js';
import { cart } from '../cart.js';
import { session } from '../session.js';
import { toast, emptyState, revealInit } from '../ui.js';
import { SHOP } from '../config.js';

const stepsBar = (step) => `
<div class="progress-steps">
  ${[1, 2, 3].map(i => `<div class="pstep ${i < step ? 'done' : ''} ${i === step ? 'on' : ''}">${esc(t('checkout.step' + i))}</div>`).join('')}
</div>`;

const summaryHTML = (items, { discount = 0, coupon = null } = {}) => {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  return `
  <div class="summary-card">
    <h3>${esc(t('cart.summary'))}</h3>
    ${items.map(i => `<div class="sumline"><span>${esc(i.name)} ×${i.qty}</span><b>${money(i.price * i.qty, lang())}</b></div>`).join('')}
    <div class="sumline"><span>${esc(t('common.subtotal'))}</span><b>${money(subtotal, lang())}</b></div>
    ${discount ? `<div class="sumline discount"><span>${esc(t('cart.discount'))}${coupon ? ` · ${esc(coupon)}` : ''}</span><b>−${money(discount, lang())}</b></div>` : ''}
    <div class="sumline total"><span>${esc(t('common.total'))}</span><span>${money(subtotal - discount, lang())}</span></div>
    <p class="faint" style="font-size:.75rem;margin-top:10px">${esc(t('common.currencyNote'))}</p>
  </div>`;
};

/* ================================================================== CART */
export const cartView = {
  titleKey: 'cart.title',
  render(app) {
    const items = cart.items();
    if (!items.length) {
      app.innerHTML = `<div class="container section"></div>`;
      app.append(emptyState({ ic: 'cart', title: t('cart.empty'), text: t('cart.emptyHint'), ctaLabel: t('cart.browse'), ctaHref: '#/catalog' }));
      return;
    }
    app.innerHTML = `
    <div class="container">
      <div class="page-head"><h1>${esc(t('cart.title'))}</h1></div>
      <div class="checkout-layout">
        <div class="cart-table">
          ${items.map(i => `
          <div class="cart-row" data-id="${esc(i.id)}">
            <a class="cart-thumb" href="#/product/${esc(i.id)}">${i.image ? `<img src="${esc(i.image)}" alt="" />` : ''}</a>
            <div class="cart-info"><h4><a href="#/product/${esc(i.id)}">${esc(i.name)}</a></h4>
              <span class="muted">${money(i.price, lang())} / ${esc(t('common.version') || '')}</span></div>
            <div class="qty">
              <button data-q="-1" aria-label="-">${icon('minus')}</button><b>${i.qty}</b><button data-q="1" aria-label="+">${icon('plus')}</button>
            </div>
            <div style="display:flex;align-items:center;gap:14px">
              <span class="cart-price">${money(i.price * i.qty, lang())}</span>
              <button class="cart-remove" aria-label="${esc(t('common.delete'))}">${icon('trash')}</button>
            </div>
          </div>`).join('')}
        </div>
        ${summaryHTML(items)}
      </div>
      <div style="display:flex;justify-content:flex-end;margin:26px 0 60px">
        <a class="btn btn--primary btn--lg" href="${session.loggedIn ? '#/checkout' : '#/login?redirect=%23/checkout'}">
          ${icon('creditCard')}${esc(session.loggedIn ? t('cart.checkout') : t('checkout.loginNeeded'))}
        </a>
      </div>
    </div>`;
    $$('.cart-row').forEach(row => {
      const id = row.dataset.id;
      row.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const l = cart.items().find(x => x.id === id); cart.setQty(id, l.qty + (+b.dataset.q)); cartView.render(app); });
      row.querySelector('.cart-remove').onclick = () => { cart.remove(id); toast(t('cart.removed'), 'info'); cartView.render(app); };
    });
  },
};

/* ============================================================== CHECKOUT */
export const checkoutView = {
  titleKey: 'checkout.title',
  async render(app, params, query) {
    const items = cart.items();
    if (!items.length) { location.hash = '#/cart'; return; }
    const settings = await db.settings.get();
    const methods = (settings.payments?.methods || []).filter(m => m.enabled);
    const profile = session.profile || {};
    let discount = 0, coupon = null;

    app.innerHTML = `
    <div class="container">
      <div class="page-head"><h1>${esc(t('checkout.title'))}</h1></div>
      ${stepsBar(1)}
      <div class="checkout-layout">
        <div>
          <div class="panel">
            <h3>${icon('user')}${esc(t('checkout.contactInfo'))}</h3>
            <div id="ck-alert"></div>
            <form id="ck-form" novalidate>
              <div class="form-grid">
                <div class="field"><label for="c-name">${esc(t('auth.fullName'))} *</label><input class="input" id="c-name" value="${esc(profile.displayName || session.displayName || '')}" required /></div>
                <div class="field"><label for="c-email">${esc(t('auth.email'))} *</label><input class="input" id="c-email" type="email" value="${esc(session.email || '')}" required /></div>
                <div class="field"><label for="c-phone">${esc(t('auth.phone'))} *</label><input class="input" id="c-phone" type="tel" placeholder="+212 6XX XXX XXX" value="${esc(profile.phone || '')}" required /></div>
                <div class="field"><label for="c-country">${esc(t('auth.country'))} *</label>
                  <select class="select" id="c-country">${SHOP.countries.map(([c, n]) => `<option value="${c}"${(profile.country || 'MA') === c ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
              </div>
            </form>
          </div>

          <div class="panel">
            <h3>${icon('creditCard')}${esc(t('checkout.paymentMethod'))}</h3>
            ${methods.map((m, i) => `
              <label class="pm-option${i === 0 ? ' on' : ''}" data-pm="${esc(m.id)}">
                <span class="pm-radio"></span>
                <span class="pm-icon">${icon(m.id === 'cih' ? 'bank' : 'creditCard')}</span>
                <span class="pm-body"><b>${esc(m.label)}</b><p>${esc(m.instructions || '')}</p></span>
              </label>`).join('') || `<div class="alert alert--warning">${icon('alert')}<span>No payment method enabled — configure them in the admin dashboard.</span></div>`}
          </div>

          <div class="panel">
            <h3>${icon('tag')}${esc(t('checkout.coupon'))}</h3>
            <div style="display:flex;gap:10px">
              <input class="input" id="ck-coupon" placeholder="WELCOME10" style="text-transform:uppercase" />
              <button class="btn btn--ghost" id="ck-apply-coupon">${esc(t('checkout.couponApply'))}</button>
            </div>
            <div id="coupon-msg" style="margin-top:8px;font-size:.85rem"></div>
          </div>
        </div>

        <div>
          <div id="ck-summary">${summaryHTML(items)}</div>
          <button class="btn btn--primary btn--block btn--lg" id="ck-place" style="margin-top:16px">${icon('check')}${esc(t('checkout.placeOrder', { total: money(cart.subtotal(), lang()) }))}</button>
          <div class="alert alert--info" style="margin-top:16px">${icon('shieldCheck')}<span>${esc(t('pay.security'))}</span></div>
        </div>
      </div>
    </div>`;

    let pm = methods[0]?.id || null;
    $$('.pm-option').forEach(o => o.onclick = () => { $$('.pm-option').forEach(x => x.classList.remove('on')); o.classList.add('on'); pm = o.dataset.pm; });

    $('#ck-apply-coupon').onclick = async () => {
      const code = $('#ck-coupon').value.trim().toUpperCase();
      const msg = $('#coupon-msg');
      if (!V.coupon(code)) { msg.innerHTML = `<span style="color:var(--danger)">${esc(t('checkout.couponBad'))}</span>`; return; }
      const r = await db.coupons.validate(code, cart.subtotal());
      if (r.ok) {
        discount = r.discount; coupon = code;
        msg.innerHTML = `<span style="color:var(--success)">${esc(t('checkout.couponOk', { code }))}</span>`;
        $('#ck-summary').innerHTML = summaryHTML(items, { discount, coupon });
        $('#ck-place').innerHTML = `${icon('check')}${esc(t('checkout.placeOrder', { total: money(cart.subtotal() - discount, lang()) }))}`;
      } else { discount = 0; coupon = null; msg.innerHTML = `<span style="color:var(--danger)">${esc(t('checkout.couponBad'))}</span>`; $('#ck-summary').innerHTML = summaryHTML(items); }
    };

    $('#ck-place').onclick = async () => {
      const name = $('#c-name').value.trim(), email = $('#c-email').value.trim(), phone = $('#c-phone').value.trim();
      const alertBox = $('#ck-alert');
      alertBox.innerHTML = '';
      const problems = [];
      if (!V.name(name)) problems.push([$('#c-name'), t('auth.fullName')]);
      if (!V.email(email)) problems.push([$('#c-email'), t('auth.email')]);
      if (!V.phone(phone)) problems.push([$('#c-phone'), t('auth.phone')]);
      if (!pm) { alertBox.innerHTML = `<div class="alert alert--error">${icon('alert')}<span>${esc(t('checkout.paymentMethod'))}</span></div>`; return; }
      if (problems.length) {
        alertBox.innerHTML = `<div class="alert alert--error">${icon('alert')}<span>${problems.map(p => esc(p[1])).join(' · ')}</span></div>`;
        problems.forEach(([inp]) => inp.classList.add('invalid'));
        return;
      }
      const btn = $('#ck-place'); btn.disabled = true; btn.innerHTML = '<span class="inline-spin"></span>';
      try {
        const order = await db.orders.create({
          customer: { name, email, phone, country: $('#c-country').value },
          items: cart.checkoutPayload(),
          paymentMethodId: pm,
          couponCode: coupon,
        });
        cart.clear();
        window.dispatchEvent(new CustomEvent('etsy:notifs'));
        location.hash = `#/success/${order.id}`;
      } catch (err) {
        console.error(err);
        alertBox.innerHTML = `<div class="alert alert--error">${icon('alert')}<span>${esc(err.message || t('common.error'))}</span></div>`;
        btn.disabled = false; btn.textContent = t('common.retry');
      }
    };
    revealInit(app);
  },
};

/* ========================================================= ORDER SUCCESS */
export const successView = {
  async render(app, params) {
    const order = await db.orders.get(params.id);
    if (!order) { location.hash = '#/404'; return; }
    app.innerHTML = `
    <div class="container section">
      <div class="order-success">
        <div class="os-icon">${icon('checkCircle')}</div>
        <h1>${esc(t('checkout.thanks'))}</h1>
        <p class="muted">${esc(t('checkout.numLabel'))}:</p>
        <div class="order-number"><span class="mono">${esc(order.orderNumber)}</span>
          <button class="copy-btn" id="copy-on" aria-label="${esc(t('common.copy'))}">${icon('copy')}</button></div>
        <p class="muted">${esc(t('common.total'))}: <b>${money(order.total, lang())}</b></p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:18px">
          <a class="btn btn--primary btn--lg" href="#/pay/${esc(order.id)}">${icon('creditCard')}${esc(t('checkout.next'))}</a>
          <a class="btn btn--ghost btn--lg" href="#/order/${esc(order.id)}">${esc(t('pay.viewOrder'))}</a>
        </div>
      </div>
    </div>`;
    $('#copy-on').onclick = () => copyText(order.orderNumber).then(() => toast(t('common.copied'), 'success'));
  },
};

/* ==================================================== PAYMENT INSTRUCTIONS */
export const payView = {
  async render(app, params) {
    const [order, settings] = await Promise.all([db.orders.get(params.id), db.settings.get()]);
    if (!order) { location.hash = '#/404'; return; }
    const pay = settings.payments || {};
    const method = (pay.methods || []).find(m => m.id === order.paymentMethodId);
    const copyRow = (label, val) => `
      <div class="copy-row"><span class="faint" style="font-size:.78rem;min-width:90px">${esc(label)}</span>
        <span class="mono">${esc(val)}</span>
        <button class="copy-btn" data-copy="${esc(val)}" aria-label="${esc(t('common.copy'))}">${icon('copy')}</button></div>`;
    app.innerHTML = `
    <div class="container">
      <div class="page-head"><h1>${esc(t('pay.instructionsTitle'))}</h1></div>
      ${stepsBar(3)}
      <div class="checkout-layout">
        <div>
          <div class="panel">
            <h3>${icon('bank')}${esc(method?.label || t('checkout.paymentMethod'))}</h3>
            <p class="muted" style="margin-bottom:18px">${esc(method?.instructions || pay.instructions || '')}</p>
            <h3>${icon('arrowR')}${esc(t('pay.transferTo'))}</h3>
            ${copyRow(t('pay.beneficiary'), pay.beneficiaryName || '—')}
            ${copyRow(t('pay.bank'), pay.bankName || '—')}
            ${copyRow(t('pay.rib'), pay.rib || '—')}
            ${copyRow(t('pay.reference'), order.orderNumber)}
            <div class="sumline total" style="border:1px solid rgba(139,92,246,.35);border-radius:14px;padding:14px 18px;margin-top:6px">
              <span>${esc(t('common.total'))}</span><span class="mono">${money(order.total, lang())}</span></div>
            <div class="alert alert--warning" style="margin-top:16px">${icon('info')}<span>${esc(t('pay.note'))}</span></div>
          </div>
        </div>
        <div>
          <div class="panel" style="text-align:center">
            <h3 style="justify-content:center">${icon('upload')}${esc(t('pay.uploadTitle'))}</h3>
            <p class="muted" style="font-size:.88rem;margin-bottom:18px">${esc(t('pay.hint', { n: SHOP.receipt.maxSizeMB }))}</p>
            <a class="btn btn--primary btn--block" href="#/receipt/${esc(order.id)}">${icon('upload')}${esc(t('orders.uploadReceipt'))}</a>
            <a class="btn btn--ghost btn--block" style="margin-top:10px" href="#/order/${esc(order.id)}">${esc(t('pay.viewOrder'))}</a>
            <div class="alert alert--info" style="margin-top:18px;text-align:start">${icon('shieldCheck')}<span>${esc(t('pay.security'))}</span></div>
          </div>
        </div>
      </div>
    </div>`;
    $$('[data-copy]').forEach(b => b.onclick = () => copyText(b.dataset.copy).then(() => toast(t('common.copied'), 'success')));
    revealInit(app);
  },
};

/* =========================================================== RECEIPT UPLOAD */
export const receiptView = {
  async render(app, params) {
    const order = await db.orders.get(params.id);
    if (!order) { location.hash = '#/404'; return; }
    if (!['awaiting_payment', 'rejected'].includes(order.status)) {
      app.innerHTML = `<div class="container section">
        <div class="panel center"><div class="spinner"></div></div></div>`;
      setTimeout(() => location.hash = `#/order/${order.id}`, 600);
      return;
    }
    app.innerHTML = `
    <div class="container">
      <div class="page-head"><h1>${esc(t('pay.uploadTitle'))}</h1>
        <p class="lead">${esc(order.orderNumber)} · ${money(order.total, lang())}</p></div>
      ${stepsBar(3)}
      <div class="checkout-layout">
        <div>
          <div class="dropzone" id="dz" tabindex="0" role="button" aria-label="${esc(t('pay.uploadCta'))}">
            ${icon('upload')}
            <p><b>${esc(t('pay.uploadCta'))}</b></p>
            <p class="faint" style="font-size:.8rem;margin-top:6px">${esc(t('pay.hint', { n: SHOP.receipt.maxSizeMB }))}</p>
            <input type="file" id="dz-input" hidden accept=".jpg,.jpeg,.png,.webp,.pdf" />
          </div>
          <div id="dz-preview"></div>
          <button class="btn btn--primary btn--block btn--lg" id="dz-upload" disabled style="margin-top:18px">
            ${icon('check')}${esc(t('common.submit'))}</button>
          <div class="alert alert--info" style="margin-top:16px">${icon('shieldCheck')}<span>${esc(t('pay.security'))}</span></div>
        </div>
        <div>${summaryHTML(order.items.map(i => ({ ...i })), { discount: order.discount, coupon: order.couponCode })}</div>
      </div>
    </div>`;
    let file = null;
    const dz = $('#dz'), input = $('#dz-input');
    dz.onclick = () => input.click();
    dz.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } };
    ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
    dz.addEventListener('drop', e => { const f = e.dataTransfer?.files?.[0]; if (f) take(f); });
    input.onchange = () => input.files[0] && take(input.files[0]);

    function take(f) {
      if (!V.fileType(f, SHOP.receipt.types)) return toast('JPG / PNG / WEBP / PDF only', 'error');
      if (!V.fileSize(f, SHOP.receipt.maxSizeMB)) return toast(`Max ${SHOP.receipt.maxSizeMB} MB`, 'error');
      file = f;
      $('#dz-preview').innerHTML = `
        <div class="file-preview">
          <span class="fp-icon">${icon(f.type.startsWith('image/') ? 'image' : 'file')}</span>
          <div style="flex:1"><b>${esc(f.name)}</b><br><span class="faint" style="font-size:.78rem">${(f.size / 1024 / 1024).toFixed(2)} MB</span></div>
          <button class="cart-remove" id="dz-clear">${icon('trash')}</button>
        </div>`;
      $('#dz-upload').disabled = false;
      $('#dz-clear').onclick = () => { file = null; $('#dz-preview').innerHTML = ''; $('#dz-upload').disabled = true; };
    }

    $('#dz-upload').onclick = async () => {
      if (!file) return;
      const btn = $('#dz-upload'); btn.disabled = true; btn.innerHTML = '<span class="inline-spin"></span>';
      try {
        await db.orders.uploadReceipt(order.id, file);
        toast(t('pay.uploaded'), 'success');
        location.hash = `#/order/${order.id}`;
      } catch (err) {
        console.error(err); toast(err.message || t('common.error'), 'error');
        btn.disabled = false; btn.innerHTML = `${icon('check')}${esc(t('common.retry'))}`;
      }
    };
    revealInit(app);
  },
};
