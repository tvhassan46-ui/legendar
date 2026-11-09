/* views/admin.js — secure administrator dashboard (guarded by router + rules) */
import { icon } from '../icons.js';
import { t, lang } from '../i18n.js';
import { esc, $, $$, money, dateFmt, V } from '../utils.js';
import { db, IS_DEMO } from '../db.js';
import { session } from '../session.js';
import { toast, statusPill, confirmDialog, openModal, catLabel, revealInit } from '../ui.js';

const NAV = [
  ['', 'dashboard', 'admin.overview'],
  ['/orders', 'box', 'admin.orders'],
  ['/products', 'grid', 'admin.products'],
  ['/categories', 'layers', 'admin.categories'],
  ['/customers', 'users', 'admin.customers'],
  ['/payments', 'bank', 'admin.payments'],
  ['/banners', 'image', 'admin.banners'],
  ['/coupons', 'tag', 'admin.coupons'],
  ['/faq', 'question', 'admin.faqM'],
  ['/messages', 'message', 'admin.messages'],
  ['/logs', 'activity', 'admin.logs'],
];

function layout(app, sub, active) {
  app.innerHTML = `
  <div class="admin-layout">
    <aside class="admin-side">
      <div class="as-head"><span class="logo-mark">${icon('logo')}</span>
        <div><b style="font-family:var(--font-display)">LEGENDAR ADMIN</b><br><span class="faint" style="font-size:.75rem">${esc(session.email || '')}</span></div></div>
      ${NAV.map(([path, ic, key]) => `<a href="#/admin${path}" class="${active === (path || '/') ? 'active' : ''}">${icon(ic)}<span>${esc(t(key))}</span></a>`).join('')}
    </aside>
    <main class="admin-main" id="admin-main"><div class="spinner"></div></main>
  </div>`;
  return $('#admin-main');
}

const statCard = (ic, value, label) => `
  <div class="stat-card reveal"><span class="sc-icon">${icon(ic)}</span><b>${value}</b><span>${esc(label)}</span></div>`;

/* =============================================================== OVERVIEW */
export const adminHome = {
  async render(app) {
    const main = layout(app, '', '/');
    const s = await db.stats();
    main.innerHTML = `
      <div class="admin-head"><h1>${esc(t('admin.overview'))}</h1>
        <span class="faint" style="font-size:.8rem">${esc(t('admin.statsNote'))}</span></div>
      ${IS_DEMO ? `<div class="alert alert--warning">${icon('alert')}<span>${esc(t('admin.demoData'))}</span></div>` : ''}
      <div class="stat-cards">
        ${statCard('dollar', money(s.revenue, lang()), t('admin.revenue'))}
        ${statCard('box', s.ordersTotal, t('admin.ordersTotal'))}
        ${statCard('clock', s.pending, t('admin.pending'))}
        ${statCard('users', s.customers, t('admin.customersTotal'))}
        ${statCard('grid', s.products, t('admin.productsTotal'))}
      </div>
      <div class="panel">
        <h3>${icon('clock')}${esc(t('admin.pendingQueue'))}</h3><div id="pending-list"></div>
      </div>
      <div class="panel">
        <h3>${icon('box')}${esc(t('admin.recentOrders'))}</h3>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>#</th><th>${esc(t('admin.customer'))}</th><th>${esc(t('common.total'))}</th><th>${esc(t('common.status'))}</th><th>${esc(t('common.date'))}</th><th></th></tr></thead>
          <tbody>${(s.orders || []).map(o => `
            <tr><td class="mono">${esc(o.orderNumber)}</td>
              <td>${esc(o.customer?.name || o.uid || '')}</td>
              <td><b>${money(o.total, lang())}</b></td>
              <td>${statusPill(o.status)}</td>
              <td>${esc(dateFmt(o.createdAt, lang()))}</td>
              <td><a class="btn btn--sm btn--ghost" href="#/admin/orders/${esc(o.id)}">→</a></td></tr>`).join('') || `<tr><td colspan="6" class="center faint">—</td></tr>`}
          </tbody></table></div>
      </div>`;
    const pend = (s.orders || []).filter(o => o.status === 'under_review');
    $('#pending-list').innerHTML = pend.length
      ? pend.map(o => `
        <div class="log-item"><span class="log-dot" style="background:var(--warning)"></span>
          <div style="flex:1"><b class="mono">${esc(o.orderNumber)}</b> · ${esc(o.customer?.name || '')} · <b>${money(o.total, lang())}</b>
          <br><span class="faint" style="font-size:.78rem">${esc(o.receiptName || '')}</span></div>
          <a class="btn btn--sm btn--primary" href="#/admin/orders/${esc(o.id)}">${esc(t('admin.viewReceipt'))} →</a></div>`).join('')
      : `<p class="faint">${esc(t('admin.noPending'))}</p>`;
    revealInit(main);
  },
};

/* ================================================================== ORDERS */
export const adminOrders = {
  async render(app, params) {
    if (params?.id) return orderDetail(layout(app, '', '/orders'), params.id);
    const main = layout(app, '', '/orders');
    const orders = await db.orders.listAll();
    main.innerHTML = `
      <div class="admin-head"><h1>${esc(t('admin.orders'))}</h1>
        <select class="select" id="ord-filter" style="width:auto">
          <option value="">${esc(t('common.all'))}</option>
          ${['awaiting_payment', 'under_review', 'paid', 'delivering', 'delivered', 'rejected', 'cancelled'].map(s => `<option value="${s}">${esc(t('st.' + s))}</option>`).join('')}
        </select></div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>#</th><th>${esc(t('admin.customer'))}</th><th>${esc(t('orders.items'))}</th><th>${esc(t('common.total'))}</th><th>${esc(t('common.status'))}</th><th>${esc(t('common.date'))}</th><th></th></tr></thead>
        <tbody id="ord-rows"></tbody></table></div>`;
    const rows = $('#ord-rows');
    const draw = (filter) => {
      const list = filter ? orders.filter(o => o.status === filter) : orders;
      rows.innerHTML = list.map(o => `
        <tr><td class="mono">${esc(o.orderNumber)}</td>
          <td>${esc(o.customer?.name || '')}<br><span class="faint" style="font-size:.75rem">${esc(o.customer?.email || '')}</span></td>
          <td>${o.items.length}</td>
          <td><b>${money(o.total, lang())}</b></td>
          <td>${statusPill(o.status)}</td>
          <td>${esc(dateFmt(o.createdAt, lang()))}</td>
          <td><a class="btn btn--sm btn--ghost" href="#/admin/orders/${esc(o.id)}">→</a></td></tr>`).join('') || `<tr><td colspan="7" class="center faint">—</td></tr>`;
    };
    draw('');
    $('#ord-filter').onchange = e => draw(e.target.value);
  },
};

async function orderDetail(main, id) {
  const order = await db.orders.get(id);
  if (!order) { main.innerHTML = `<div class="alert alert--error">${esc(t('common.noResults'))}</div>`; return; }
  main.innerHTML = `
    <div class="admin-head"><h1 class="mono">${esc(order.orderNumber)}</h1>${statusPill(order.status)}</div>
    ${order.status === 'rejected' && order.rejectReason ? `<div class="alert alert--error">${icon('alert')}<span>${esc(order.rejectReason)}</span></div>` : ''}
    <div class="checkout-layout">
      <div>
        <div class="panel"><h3>${icon('receipt')}${esc(t('admin.viewReceipt'))}</h3><div id="rc-slot"></div></div>
        <div class="panel"><h3>${icon('activity')}${esc(t('orders.timelineTitle'))}</h3>
          <div class="timeline">${(order.timeline || []).map(e => `
            <div class="tl-item done"><b>${esc(t('st.' + (e.status === 'created' ? 'awaiting_payment' : e.status === 'receipt' ? 'under_review' : e.status)))}</b>
              <time>${esc(dateFmt(e.at, lang()))}</time>${e.note ? `<p>${esc(e.note)}</p>` : ''}</div>`).join('')}</div></div>
      </div>
      <div>
        <div class="panel"><h3>${icon('user')}${esc(t('admin.customer'))}</h3>
          <div class="sumline"><span>${esc(t('auth.fullName'))}</span><b>${esc(order.customer?.name || '')}</b></div>
          <div class="sumline"><span>${esc(t('auth.email'))}</span><b>${esc(order.customer?.email || '')}</b></div>
          <div class="sumline"><span>${esc(t('auth.phone'))}</span><b>${esc(order.customer?.phone || '')}</b></div>
          <div class="sumline"><span>${esc(t('auth.country'))}</span><b>${esc(order.customer?.country || '')}</b></div>
          <div class="sumline total"><span>${esc(t('common.total'))}</span><span>${money(order.total, lang())}</span></div>
        </div>
        <div class="panel" id="actions-slot"><h3>${icon('settings')}${esc(t('common.actions'))}</h3></div>
      </div>
    </div>`;
  /* receipt */
  const rcSlot = $('#rc-slot');
  const url = order.receiptName ? await db.storage.receiptUrl(order).catch(() => null) : null;
  if (order.receiptName) {
    if (url) rcSlot.innerHTML = `<img src="${esc(url)}" alt="receipt" style="border-radius:12px;border:1px solid var(--border)" />`;
    else rcSlot.innerHTML = `<div class="file-preview"><span class="fp-icon">${icon('file')}</span><div><b>${esc(order.receiptName)}</b><br><span class="faint" style="font-size:.78rem">${esc(dateFmt(order.receiptAt, lang()))}</span></div></div>`;
  } else rcSlot.innerHTML = `<p class="faint">—</p>`;

  /* actions */
  const slot = $('#actions-slot');
  if (order.status === 'under_review') {
    slot.innerHTML += `
      <button class="btn btn--success btn--block" id="a-approve" style="margin-bottom:10px">${icon('check')}${esc(t('admin.approve'))}</button>
      <button class="btn btn--danger btn--block" id="a-reject">${icon('x')}${esc(t('admin.reject'))}</button>`;
    $('#a-approve').onclick = async () => {
      if (!(await confirmDialog(t('admin.approve') + ' ?', { danger: false }))) return;
      try { await db.orders.review(id, { approve: true }); toast(t('toast.saved'), 'success'); adminOrders.render(document.getElementById('app'), { id }); }
      catch (e) { toast(e.message, 'error'); }
    };
    $('#a-reject').onclick = () => {
      openModal({
        title: t('admin.reject'),
        body: `<div class="field"><label>Reason</label><textarea class="textarea" id="rej-reason" maxlength="500"></textarea></div>`,
        actions: [
          { label: t('common.cancel'), class: 'btn--ghost', onClick: () => {} },
          {
            label: t('admin.reject'), class: 'btn--danger', onClick: async () => {
              const reason = document.getElementById('rej-reason')?.value.trim() || '';
              try { await db.orders.review(id, { approve: false, reason }); location.hash = '#/admin/orders'; } catch (e) { toast(e.message, 'error'); }
            },
          },
        ],
      });
    };
  } else if (['paid'].includes(order.status)) {
    slot.innerHTML += `
      <div class="field"><label>${esc(t('orders.deliveryNote'))}</label><textarea class="textarea" id="dl-note" maxlength="800">${esc(order.deliveryNote || '')}</textarea></div>
      <button class="btn btn--primary btn--block" id="a-delivering">${icon('send')}${esc(t('admin.setDelivering'))}</button>`;
    $('#a-delivering').onclick = async () => {
      try { await db.orders.setStatus(id, 'delivering', $('#dl-note').value.trim()); toast(t('toast.saved'), 'success'); adminOrders.render(document.getElementById('app'), { id }); }
      catch (e) { toast(e.message, 'error'); }
    };
  } else if (order.status === 'delivering') {
    slot.innerHTML += `
      <div class="field"><label>${esc(t('orders.deliveryNote'))}</label><textarea class="textarea" id="dl-note2" maxlength="800">${esc(order.deliveryNote || '')}</textarea></div>
      <button class="btn btn--success btn--block" id="a-delivered">${icon('check')}${esc(t('admin.setDelivered'))}</button>`;
    $('#a-delivered').onclick = async () => {
      try { await db.orders.setStatus(id, 'delivered', $('#dl-note2').value.trim()); toast(t('toast.saved'), 'success'); adminOrders.render(document.getElementById('app'), { id }); }
      catch (e) { toast(e.message, 'error'); }
    };
  } else {
    slot.innerHTML += `<p class="faint">—</p>`;
  }
}

/* ================================================================ PRODUCTS */
export const adminProducts = {
  async render(app, params) {
    const main = layout(app, '', '/products');
    if (params?.id !== undefined || location.hash.includes('/products/new') || params?.id === 'new') { /* handled by route */ }
    const products = await db.products.list({ includeUnlisted: true });
    main.innerHTML = `
      <div class="admin-head"><h1>${esc(t('admin.products'))} (${products.length})</h1>
        <a class="btn btn--primary btn--sm" href="#/admin/products/new">${icon('plus')}${esc(t('admin.addProduct'))}</a></div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>${esc(t('admin.name'))}</th><th>${esc(t('common.category'))}</th><th>${esc(t('admin.price'))}</th><th>${esc(t('admin.stock'))}</th><th>${esc(t('admin.listed'))}</th><th>${esc(t('common.actions'))}</th></tr></thead>
        <tbody>${products.map(p => `
          <tr><td><b>${esc(p.name)}</b>${p.demo ? ' <span class="tag tag--demo">DEMO</span>' : ''}<br><span class="faint" style="font-size:.75rem">${esc(p.version || '')} ${esc(String(p.year || ''))}</span></td>
            <td>${esc(p.cat || '')}</td>
            <td><b>${money(p.price, lang())}</b></td>
            <td>${p.stock !== false ? '✅' : '❌'}</td>
            <td>${p.listed !== false ? '✅' : '❌'}</td>
            <td><div class="row-actions">
              <a class="icon-btn" href="#/admin/products/${esc(p.id)}" title="${esc(t('common.edit'))}">${icon('edit')}</a>
              <button class="icon-btn" data-del="${esc(p.id)}" data-name="${esc(p.name)}" title="${esc(t('common.delete'))}" style="color:#fca5a5">${icon('trash')}</button>
            </div></td></tr>`).join('')}</tbody></table></div>`;
    $$('[data-del]').forEach(b => b.onclick = async () => {
      if (!(await confirmDialog(t('admin.deleteConfirm', { name: b.dataset.name })))) return;
      await db.products.remove(b.dataset.del);
      toast(t('toast.deleted'), 'info');
      adminProducts.render(app);
    });
  },
};

export const adminProductEdit = {
  async render(app, params) {
    const main = layout(app, '', '/products');
    const isNew = params.id === 'new';
    const p = isNew ? { images: [], features: [], os: [], faq: [] } : await db.products.get(params.id);
    if (!p) { main.innerHTML = `<div class="alert alert--error">${esc(t('pdp.notFound'))}</div>`; return; }
    const categories = await db.categories.list();
    const tops = categories.filter(c => !c.parent);
    const subsOf = (parent) => categories.filter(c => c.parent === parent);

    main.innerHTML = `
    <div class="admin-head"><h1>${esc(isNew ? t('admin.addProduct') : t('admin.editTitle') + ' — ' + p.name)}</h1>
      ${!isNew ? `<a class="btn btn--ghost btn--sm" href="#/product/${esc(p.id)}">${icon('eye')}</a>` : ''}</div>
    <form id="pe-form">
      <div class="panel"><h3>${icon('info')}${esc(t('admin.general'))}</h3>
        <div class="form-grid">
          <div class="field"><label>${esc(t('admin.name'))} *</label><input class="input" id="pe-name" value="${esc(p.name || '')}" required /></div>
          <div class="field"><label>Vendor</label><input class="input" id="pe-vendor" value="${esc(p.vendor || '')}" /></div>
          <div class="field"><label>${esc(t('common.category'))} (top) *</label>
            <select class="select" id="pe-cat">${tops.map(c => `<option value="${esc(c.id)}"${p.cat === c.id ? ' selected' : ''}>${esc(catLabel(c))}</option>`).join('')}</select></div>
          <div class="field"><label>${esc(t('common.category'))} (sub)</label>
            <select class="select" id="pe-subcat">${subsOf(p.cat || tops[0]?.id).map(c => `<option value="${esc(c.id)}"${p.category === c.id ? ' selected' : ''}>${esc(catLabel(c))}</option>`).join('')}</select></div>
          <div class="field"><label>${esc(t('common.version'))}</label><input class="input" id="pe-version" value="${esc(p.version || '')}" /></div>
          <div class="field"><label>${esc(t('common.year'))}</label><input class="input" id="pe-year" type="number" value="${esc(String(p.year || ''))}" /></div>
        </div>
        <div class="field"><label>${esc(t('admin.desc'))} *</label><textarea class="textarea" id="pe-desc" maxlength="4000" required>${esc(p.desc || '')}</textarea></div>
        <div class="form-grid">
          <div class="field"><label>${esc(t('pdp.features'))} (1/line)</label><textarea class="textarea" id="pe-features">${esc((p.features || []).join('\n'))}</textarea></div>
          <div class="field"><label>${esc(t('pdp.os'))} (1/line)</label><textarea class="textarea" id="pe-os">${esc((p.os || []).join('\n'))}</textarea></div>
        </div>
      </div>

      <div class="panel"><h3>${icon('dollar')}${esc(t('admin.pricing'))}</h3>
        <div class="form-grid">
          <div class="field"><label>${esc(t('admin.price'))} *</label><input class="input" id="pe-price" type="number" min="0" step="0.01" value="${esc(String(p.price ?? ''))}" required /></div>
          <div class="field"><label>${esc(t('admin.compareAt'))}</label><input class="input" id="pe-compare" type="number" min="0" step="0.01" value="${esc(String(p.compareAt ?? ''))}" /></div>
        </div>
        <div style="display:flex;gap:22px;flex-wrap:wrap;margin-top:6px">
          <label class="checkline"><input type="checkbox" id="pe-stock" ${p.stock !== false ? 'checked' : ''}/>${esc(t('admin.stock'))}</label>
          <label class="checkline"><input type="checkbox" id="pe-listed" ${p.listed !== false ? 'checked' : ''}/>${esc(t('admin.listed'))}</label>
          <label class="checkline"><input type="checkbox" id="pe-featured" ${p.featured ? 'checked' : ''}/>${esc(t('admin.featured'))}</label>
          <label class="checkline"><input type="checkbox" id="pe-popular" ${p.popular ? 'checked' : ''}/>${esc(t('admin.popular'))}</label>
        </div>
      </div>

      <div class="panel"><h3>${icon('image')}${esc(t('admin.media'))}</h3>
        <div class="img-thumbs" id="pe-thumbs"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
          <label class="img-uploader" style="flex:1;min-width:200px">${esc('Upload image')}<input type="file" id="pe-img-input" accept="image/*" hidden /></label>
          <input class="input" id="pe-img-url" placeholder="https://… (image URL)" style="flex:1;min-width:200px" />
          <button type="button" class="btn btn--ghost btn--sm" id="pe-img-add">+</button>
        </div>
      </div>

      <div class="panel"><h3>${icon('file')}${esc(t('admin.extra'))}</h3>
        <div class="form-grid">
          <div class="field"><label>${esc(t('pdp.license'))}</label><input class="input" id="pe-license" value="${esc(p.licenseType || '')}" /></div>
          <div class="field"><label>${esc(t('pdp.validity'))}</label><input class="input" id="pe-validity" value="${esc(p.validity || '')}" /></div>
          <div class="field"><label>${esc(t('pdp.delivery'))}</label><input class="input" id="pe-delivery" value="${esc(p.delivery || 'Digital delivery after payment verification')}" /></div>
          <div class="field"><label>${esc(t('pdp.requirements'))}</label><input class="input" id="pe-req" value="${esc(p.requirements || '')}" /></div>
        </div>
        <div class="field"><label>${esc(t('pdp.faq'))} — "Question|Answer" 1/line</label><textarea class="textarea" id="pe-faq">${esc((p.faq || []).map(f => f.q + '|' + f.a).join('\n'))}</textarea></div>
      </div>
      <div style="display:flex;gap:12px">
        <button class="btn btn--primary btn--lg" type="submit">${icon('check')}${esc(t('common.save'))}</button>
        <a class="btn btn--ghost btn--lg" href="#/admin/products">${esc(t('common.cancel'))}</a>
      </div>
    </form>`;

    let images = [...(p.images || [])];
    const drawThumbs = () => {
      $('#pe-thumbs').innerHTML = images.map((im, i) => `
        <span class="img-thumb"><img src="${esc(im)}" alt="" /><button type="button" data-imdel="${i}">${icon('x')}</button></span>`).join('');
      $$('[data-imdel]').forEach(b => b.onclick = () => { images.splice(+b.dataset.imdel, 1); drawThumbs(); });
    };
    drawThumbs();
    $('#pe-img-add').onclick = () => { const u = $('#pe-img-url').value.trim(); if (/^https?:\/\//.test(u)) { images.push(u); $('#pe-img-url').value = ''; drawThumbs(); } };
    $('#pe-img-input').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      if (!V.fileType(f, ['image/jpeg', 'image/png', 'image/webp'])) return toast('JPG/PNG/WEBP', 'error');
      if (!V.fileSize(f, 3)) return toast('Max 3 MB', 'error');
      toast(t('common.loading'), 'info');
      const url = await db.storage.uploadProductImage(p.id || 'new', f);
      if (url) { images.push(url); drawThumbs(); toast(t('toast.saved'), 'success'); }
    };
    /* subcat options follow top selection */
    $('#pe-cat').onchange = e => {
      $('#pe-subcat').innerHTML = subsOf(e.target.value).map(c => `<option value="${esc(c.id)}">${esc(catLabel(c))}</option>`).join('');
    };

    $('#pe-form').onsubmit = async e => {
      e.preventDefault();
      const name = $('#pe-name').value.trim(), price = parseFloat($('#pe-price').value);
      if (!V.name(name) || !(price >= 0)) return toast(t('common.error'), 'error');
      const data = {
        id: isNew ? undefined : p.id,
        name, vendor: $('#pe-vendor').value.trim(),
        cat: $('#pe-cat').value, category: $('#pe-subcat').value,
        version: $('#pe-version').value.trim(), year: parseInt($('#pe-year').value) || null,
        desc: $('#pe-desc').value.trim(),
        features: $('#pe-features').value.split('\n').map(s => s.trim()).filter(Boolean),
        os: $('#pe-os').value.split('\n').map(s => s.trim()).filter(Boolean),
        price, compareAt: parseFloat($('#pe-compare').value) || null,
        stock: $('#pe-stock').checked, listed: $('#pe-listed').checked,
        featured: $('#pe-featured').checked, popular: $('#pe-popular').checked,
        images, licenseType: $('#pe-license').value.trim(), validity: $('#pe-validity').value.trim(),
        delivery: $('#pe-delivery').value.trim(), requirements: $('#pe-req').value.trim(),
        faq: $('#pe-faq').value.split('\n').map(l => l.split('|')).filter(a => a.length >= 2).map(a => ({ q: a[0].trim(), a: a.slice(1).join('|').trim() })),
      };
      try { await db.products.save(data); toast(t('toast.saved'), 'success'); location.hash = '#/admin/products'; }
      catch (err) { toast(err.message || t('common.error'), 'error'); }
    };
  },
};

/* =============================================================== CATEGORIES */
export const adminCategories = {
  async render(app) {
    const main = layout(app, '', '/categories');
    const cats = await db.categories.list();
    main.innerHTML = `
      <div class="admin-head"><h1>${esc(t('admin.categories'))}</h1></div>
      <div class="checkout-layout">
        <div class="panel"><h3>${icon('layers')}${esc(t('common.edit'))}</h3>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>${esc(t('admin.catName'))}</th><th>Slug</th><th>Parent</th><th></th></tr></thead>
          <tbody>${cats.map(c => `
            <tr><td><b>${esc(catLabel(c))}</b></td><td class="mono">${esc(c.id)}</td><td>${esc(c.parent || '—')}</td>
              <td><div class="row-actions">
                <button class="icon-btn" data-cedit="${esc(c.id)}">${icon('edit')}</button>
                <button class="icon-btn" data-cdel="${esc(c.id)}" style="color:#fca5a5">${icon('trash')}</button>
              </div></td></tr>`).join('')}</tbody></table></div>
        </div>
        <div class="panel"><h3>${icon('plus')}${esc(t('admin.newCat'))}</h3>
          <div class="field"><label>${esc(t('admin.catName'))}</label><input class="input" id="nc-name" /></div>
          <div class="field"><label>${esc(t('admin.catName'))} (FR)</label><input class="input" id="nc-nameFr" /></div>
          <div class="field"><label>${esc(t('admin.catName'))} (AR)</label><input class="input" id="nc-nameAr" /></div>
          <div class="field"><label>Slug (id)</label><input class="input" id="nc-slug" placeholder="my-category" /></div>
          <div class="field"><label>Parent</label><select class="select" id="nc-parent"><option value="">—</option>${cats.filter(c => !c.parent).map(c => `<option value="${esc(c.id)}">${esc(catLabel(c))}</option>`).join('')}</select></div>
          <div class="field"><label>Description</label><input class="input" id="nc-desc" /></div>
          <button class="btn btn--primary btn--block" id="nc-save">${esc(t('common.create'))}</button>
        </div>
      </div>`;
    $('#nc-save').onclick = async () => {
      const name = $('#nc-name').value.trim();
      const slug = ($('#nc-slug').value.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/^-+|-+$/g, '');
      if (!name || !slug) return toast(t('common.error'), 'error');
      await db.categories.save({ id: slug, slug, name, nameFr: $('#nc-nameFr').value.trim(), nameAr: $('#nc-nameAr').value.trim(), parent: $('#nc-parent').value || null, desc: $('#nc-desc').value.trim() });
      toast(t('toast.saved'), 'success'); adminCategories.render(app);
    };
    $$('[data-cdel]').forEach(b => b.onclick = async () => {
      if (!(await confirmDialog(t('admin.deleteConfirm', { name: b.dataset.cdel })))) return;
      await db.categories.remove(b.dataset.cdel); toast(t('toast.deleted'), 'info'); adminCategories.render(app);
    });
    $$('[data-cedit]').forEach(b => b.onclick = () => {
      const c = cats.find(x => x.id === b.dataset.cedit);
      $('#nc-name').value = catLabel(c); $('#nc-slug').value = c.id; $('#nc-desc').value = c.desc || '';
      $('#nc-nameFr').value = c.nameFr || ''; $('#nc-nameAr').value = c.nameAr || ''; $('#nc-parent').value = c.parent || '';
    });
  },
};

/* =============================================================== CUSTOMERS */
export const adminCustomers = {
  async render(app) {
    const main = layout(app, '', '/customers');
    const users = await db.users.list();
    main.innerHTML = `
      <div class="admin-head"><h1>${esc(t('admin.customers'))} (${users.length})</h1></div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>${esc(t('auth.fullName'))}</th><th>${esc(t('auth.email'))}</th><th>${esc(t('admin.role'))}</th><th>${esc(t('orders.title'))}</th><th>Total</th><th>${esc(t('common.date'))}</th><th></th></tr></thead>
        <tbody>${users.map(u => `
          <tr><td><b>${esc(u.displayName || '—')}</b></td><td>${esc(u.email)} ${u.emailVerified ? '' : '⚠'}</td>
            <td>${u.role === 'admin' ? '<span class="tag tag--hot">ADMIN</span>' : '<span class="tag tag--new">customer</span>'}</td>
            <td>${u.ordersCount}</td><td>${money(u.spent || 0, lang())}</td>
            <td>${esc(dateFmt(u.createdAt, lang()))}</td>
            <td><button class="btn btn--sm ${u.role === 'admin' ? 'btn--danger' : 'btn--ghost'}" data-role="${esc(u.uid)}" data-to="${u.role === 'admin' ? 'customer' : 'admin'}">
              ${u.role === 'admin' ? '→ customer' : '→ admin'}</button></td></tr>`).join('')}</tbody></table></div>`;
    $$('[data-role]').forEach(b => b.onclick = async () => {
      if (!(await confirmDialog(`${b.dataset.role} → ${b.dataset.to}?`))) return;
      try { await db.users.setRole(b.dataset.role, b.dataset.to); toast(t('toast.saved'), 'success'); adminCustomers.render(app); }
      catch (e) { toast(e.message || t('common.error'), 'error'); }
    });
  },
};

/* ============================================================ PAYMENT SETTINGS */
export const adminPayments = {
  async render(app) {
    const main = layout(app, '', '/payments');
    const s = await db.settings.get();
    const pay = s.payments || {};
    main.innerHTML = `
      <div class="admin-head"><h1>${esc(t('admin.paySettings'))}</h1></div>
      <div class="checkout-layout">
        <div class="panel"><h3>${icon('bank')}${esc(t('admin.paySettings'))}</h3>
          <div class="field"><label>${esc(t('admin.beneficiary'))}</label><input class="input" id="ps-beneficiary" value="${esc(pay.beneficiaryName || '')}" /></div>
          <div class="field"><label>${esc(t('admin.bankName'))}</label><input class="input" id="ps-bank" value="${esc(pay.bankName || '')}" /></div>
          <div class="field"><label>${esc(t('admin.rib'))}</label><input class="input mono" id="ps-rib" value="${esc(pay.rib || '')}" />
            <span class="field-hint">RIB is shown to customers to make the transfer — never include passwords or secrets.</span></div>
          <div class="field"><label>${esc(t('admin.payInstr'))}</label><textarea class="textarea" id="ps-instr">${esc(pay.instructions || '')}</textarea></div>
          <button class="btn btn--primary" id="ps-save">${icon('check')}${esc(t('common.save'))}</button>
        </div>
        <div class="panel"><h3>${icon('creditCard')}${esc(t('admin.methods'))}</h3>
          ${(pay.methods || []).map((m, i) => `
            <label class="pm-option${m.enabled ? ' on' : ''}">
              <span class="pm-radio"></span>
              <span class="pm-icon">${icon(m.id === 'cih' ? 'bank' : 'creditCard')}</span>
              <span class="pm-body"><b>${esc(m.label)}</b><p>${esc(m.instructions || '')}</p></span>
              <input type="checkbox" data-pm="${esc(m.id)}" ${m.enabled ? 'checked' : ''} style="accent-color:var(--accent);width:18px;height:18px" />
            </label>`).join('')}
          <p class="faint" style="font-size:.8rem;margin-top:12px">${esc('Enable/disable payment methods — toggling saves instantly.')}</p>
        </div>
      </div>`;
    $('#ps-save').onclick = async () => {
      const rib = $('#ps-rib').value.trim();
      if (rib && !V.rib(rib)) return toast('RIB: 20-34 digits', 'error');
      await db.settings.save('payments', {
        beneficiaryName: $('#ps-beneficiary').value.trim(), bankName: $('#ps-bank').value.trim(),
        rib, instructions: $('#ps-instr').value.trim(),
      });
      toast(t('toast.saved'), 'success');
    };
    $$('[data-pm]').forEach(cb => cb.onchange = async () => {
      const methods = (pay.methods || []).map(m => ({ ...m, enabled: m.id === cb.dataset.pm ? cb.checked : m.enabled }));
      await db.settings.save('payments', { methods });
      toast(t('toast.saved'), 'success');
      cb.closest('.pm-option').classList.toggle('on', cb.checked);
    });
  },
};

/* ================================================================ BANNERS */
export const adminBanners = {
  async render(app) {
    const main = layout(app, '', '/banners');
    const s = await db.settings.get();
    const hp = s.homepage || {};
    main.innerHTML = `
      <div class="admin-head"><h1>${esc(t('admin.banners'))}</h1></div>
      <div class="checkout-layout">
        <div class="panel"><h3>${icon('edit')}${esc('Hero')}</h3>
          <div class="field"><label>${esc('Hero title — line 1')}</label><input class="input" id="bn-t1" value="${esc(hp.heroTitleA || '')}" /></div>
          <div class="field"><label>${esc('Hero title — line 2 (gradient)')}</label><input class="input" id="bn-t2" value="${esc(hp.heroTitleB || '')}" /></div>
          <div class="field"><label>${esc('Hero subtitle (blank = default translation)')}</label><textarea class="textarea" id="bn-sub">${esc(hp.heroSubtitle || '')}</textarea></div>
          <div class="field"><label>${esc('Announcement bar')}</label><input class="input" id="bn-ann" value="${esc(hp.announce || '')}" /></div>
          <button class="btn btn--primary" id="bn-save">${icon('check')}${esc(t('common.save'))}</button>
        </div>
        <div class="panel"><h3>${icon('image')}${esc('Banner image')}</h3>
          <label class="img-uploader" style="padding:30px">${esc('Upload banner image (optional)')}<input type="file" id="bn-file" accept="image/*" hidden /></label>
          ${hp.banner ? `<img src="${esc(hp.banner)}" alt="" style="border-radius:12px;margin-top:14px;border:1px solid var(--border)" />` : ''}
        </div>
      </div>`;
    $('#bn-save').onclick = async () => {
      await db.settings.save('homepage', {
        heroTitleA: $('#bn-t1').value.trim(), heroTitleB: $('#bn-t2').value.trim(),
        heroSubtitle: $('#bn-sub').value.trim(), announce: $('#bn-ann').value.trim(),
      });
      toast(t('toast.saved'), 'success');
    };
    $('#bn-file').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      if (!V.fileType(f, ['image/jpeg', 'image/png', 'image/webp'])) return toast('JPG/PNG/WEBP', 'error');
      const url = await db.storage.uploadBanner(f);
      if (url) { await db.settings.save('homepage', { banner: url }); toast(t('toast.saved'), 'success'); adminBanners.render(app); }
    };
  },
};

/* ================================================================ COUPONS */
export const adminCoupons = {
  async render(app) {
    const main = layout(app, '', '/coupons');
    const coupons = await db.coupons.list();
    main.innerHTML = `
      <div class="admin-head"><h1>${esc(t('admin.coupons'))}</h1></div>
      <div class="checkout-layout">
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>${esc(t('admin.couponCode'))}</th><th>${esc(t('admin.couponType'))}</th><th>${esc(t('admin.value'))}</th><th>${esc(t('admin.minTotal'))}</th><th>Uses</th><th>${esc(t('admin.active'))}</th><th></th></tr></thead>
          <tbody>${coupons.map(c => `
            <tr><td class="mono"><b>${esc(c.code)}</b></td>
              <td>${c.type === 'percent' ? '%' : 'MAD'}</td><td>${esc(String(c.value))}</td>
              <td>${esc(String(c.minTotal || 0))}</td>
              <td>${esc(String(c.usedCount || 0))}/${esc(String(c.maxUses || '∞'))}</td>
              <td>${c.active ? '✅' : '❌'}</td>
              <td><button class="icon-btn" data-cpdel="${esc(c.id)}" style="color:#fca5a5">${icon('trash')}</button></td></tr>`).join('')}</tbody></table></div>
        <div class="panel"><h3>${icon('plus')}${esc(t('admin.coupons'))}</h3>
          <div class="field"><label>${esc(t('admin.couponCode'))}</label><input class="input mono" id="cp-code" placeholder="WELCOME10" style="text-transform:uppercase" /></div>
          <div class="form-grid">
            <div class="field"><label>${esc(t('admin.couponType'))}</label>
              <select class="select" id="cp-type"><option value="percent">${esc(t('admin.percent'))}</option><option value="fixed">${esc(t('admin.fixed'))}</option></select></div>
            <div class="field"><label>${esc(t('admin.value'))}</label><input class="input" id="cp-value" type="number" min="1" /></div>
            <div class="field"><label>${esc(t('admin.minTotal'))}</label><input class="input" id="cp-min" type="number" min="0" value="0" /></div>
            <div class="field"><label>${esc(t('admin.maxUses'))}</label><input class="input" id="cp-max" type="number" min="1" /></div>
          </div>
          <label class="checkline" style="margin-bottom:14px"><input type="checkbox" id="cp-active" checked />${esc(t('admin.active'))}</label>
          <button class="btn btn--primary btn--block" id="cp-save">${esc(t('common.create'))}</button>
        </div>
      </div>`;
    $('#cp-save').onclick = async () => {
      const code = $('#cp-code').value.trim().toUpperCase();
      const value = parseFloat($('#cp-value').value);
      if (!V.coupon(code) || !(value > 0)) return toast(t('common.error'), 'error');
      await db.coupons.save({ code, type: $('#cp-type').value, value, minTotal: +$('#cp-min').value || 0, maxUses: +$('#cp-max').value || null, active: $('#cp-active').checked });
      toast(t('toast.saved'), 'success'); adminCoupons.render(app);
    };
    $$('[data-cpdel]').forEach(b => b.onclick = async () => {
      if (!(await confirmDialog(t('common.confirm')))) return;
      await db.coupons.remove(b.dataset.cpdel); adminCoupons.render(app);
    });
  },
};

/* ================================================================ FAQ ADMIN */
export const adminFaq = {
  async render(app) {
    const main = layout(app, '', '/faq');
    const faqs = await db.faq.list();
    main.innerHTML = `
      <div class="admin-head"><h1>${esc(t('admin.faqM'))}</h1></div>
      ${faqs.map(f => `
        <div class="panel"><div style="display:flex;gap:10px;align-items:flex-start">
          <div style="flex:1">
            <b>${esc(f.q)}</b><p class="muted" style="font-size:.88rem;margin-top:6px">${esc(f.a)}</p></div>
          <button class="icon-btn" data-fedit="${esc(f.id)}">${icon('edit')}</button>
          <button class="icon-btn" data-fdel="${esc(f.id)}" style="color:#fca5a5">${icon('trash')}</button>
        </div></div>`).join('')}
      <div class="panel"><h3>${icon('plus')}${esc(t('common.create'))}</h3>
        <div class="field"><label>${esc(t('admin.faqQ'))}</label><input class="input" id="fq-q" /></div>
        <div class="field"><label>${esc(t('admin.faqA'))}</label><textarea class="textarea" id="fq-a"></textarea></div>
        <div class="field"><label>${esc(t('admin.position'))}</label><input class="input" id="fq-order" type="number" value="99" /></div>
        <button class="btn btn--primary" id="fq-save">${esc(t('common.save'))}</button>
      </div>`;
    $('#fq-save').onclick = async () => {
      const q = $('#fq-q').value.trim(), a = $('#fq-a').value.trim();
      if (!q || !a) return toast(t('common.error'), 'error');
      await db.faq.save({ q, a, order: +$('#fq-order').value || 99 });
      toast(t('toast.saved'), 'success'); adminFaq.render(app);
    };
    $$('[data-fdel]').forEach(b => b.onclick = async () => { await db.faq.remove(b.dataset.fdel); adminFaq.render(app); });
    $$('[data-fedit]').forEach(b => b.onclick = () => {
      const f = faqs.find(x => x.id === b.dataset.fedit);
      $('#fq-q').value = f.q; $('#fq-a').value = f.a; $('#fq-order').value = f.order || 99;
    });
  },
};

/* =============================================================== MESSAGES */
export const adminMessages = {
  async render(app) {
    const main = layout(app, '', '/messages');
    const msgs = await db.messages.list();
    main.innerHTML = `
      <div class="admin-head"><h1>${esc(t('admin.messages'))} (${msgs.length})</h1></div>
      ${msgs.map(m => `
        <div class="panel" style="${m.status === 'new' ? 'border-color:rgba(139,92,246,.45)' : ''}">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <div><b>${esc(m.subject)}</b> — ${esc(m.name)} &lt;${esc(m.email)}&gt;</div>
            <div style="display:flex;gap:8px;align-items:center">
              <span class="faint" style="font-size:.75rem">${esc(dateFmt(m.at, lang()))}</span>
              ${m.status === 'new' ? `<button class="btn btn--sm btn--ghost" data-mread="${esc(m.id)}">${esc(t('admin.markRead'))}</button>` : ''}
              <a class="btn btn--sm btn--primary" href="mailto:${esc(m.email)}?subject=Re: ${esc(m.subject)}">${icon('mail')}</a>
            </div>
          </div>
          <p class="muted" style="margin-top:10px;font-size:.92rem">${esc(m.message)}</p>
        </div>`).join('') || `<p class="faint">—</p>`}`;
    $$('[data-mread]').forEach(b => b.onclick = async () => { await db.messages.markRead(b.dataset.mread); adminMessages.render(app); });
  },
};

/* =================================================================== LOGS */
export const adminLogs = {
  async render(app) {
    const main = layout(app, '', '/logs');
    const logs = await db.logs.list();
    main.innerHTML = `
      <div class="admin-head"><h1>${esc(t('admin.logs'))}</h1></div>
      <div class="panel">
        ${logs.map(l => `<div class="log-item"><span class="log-dot"></span>
          <div style="flex:1"><b class="mono" style="font-size:.82rem">${esc(l.action)}</b>
            <span class="muted" style="font-size:.82rem"> · ${esc(l.details || '')} · ${esc(l.actor || '')}</span></div>
          <time>${esc(dateFmt(l.at, lang()))}</time></div>`).join('') || `<p class="faint">${esc(t('admin.logsEmpty'))}</p>`}
      </div>`;
  },
};
