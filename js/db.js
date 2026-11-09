/* ============================================================================
 * db.js — unified data layer.
 *   • Firestore backend (production): real Firestore/Storage/Cloud Functions.
 *   • Demo backend: seeded localStorage, same API, clearly-labelled DEMO data.
 * Views never talk to Firebase directly — only through this module.
 * ==========================================================================*/
import { initFirebase, fb } from './firebase.js';
import { FIREBASE_CONFIGURED, SHOP } from './config.js';
import { session } from './session.js';
import { genOrderNumber, uid as rid } from './utils.js';
import {
  DEMO_CATEGORIES, DEMO_PRODUCTS, DEMO_SETTINGS, DEMO_FAQ, DEMO_COUPONS, DEMO_USERS
} from './demo-data.js';

export const IS_DEMO = !FIREBASE_CONFIGURED;
export const db = { mode: () => (IS_DEMO ? 'demo' : 'firestore') };

/* ----------------------------------------------------------- local helpers */
function LSget(k, fallback) {
  try { const v = localStorage.getItem('etsy.db.' + k); return v ? JSON.parse(v) : structuredClone(fallback); }
  catch { return structuredClone(fallback); }
}
function LSset(k, v) { localStorage.setItem('etsy.db.' + k, JSON.stringify(v)); }

async function shrinkImage(file, max = 820, quality = .82) {
  if (!file.type.startsWith('image/')) return null;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  } finally { URL.revokeObjectURL(url); }
}

export function couponDiscount(c, subtotal) {
  if (!c || subtotal < (c.minTotal || 0)) return 0;
  const d = c.type === 'percent' ? Math.round(subtotal * c.value) / 100 : c.value;
  return Math.min(d, subtotal);
}

/* =========================================================== DEMO BACKEND */
function initDemo() {
  // seed
  if (!localStorage.getItem('etsy.db.products')) {
    LSset('products', DEMO_PRODUCTS);
    LSset('categories', DEMO_CATEGORIES);
    LSset('faq', DEMO_FAQ);
    LSset('coupons', DEMO_COUPONS);
    LSset('settings', DEMO_SETTINGS);
    LSset('users', DEMO_USERS);
    LSset('orders', []); LSset('events', {}); LSset('msgs', []);
    LSset('logs', []); LSset('notifs', []); LSset('reviews', []);
  }
  // Apply newly bundled catalog images to existing demo records without
  // overwriting images that an admin has already configured.
  const storedProducts = LSget('products', []);
  const removedDemoProductIds = new Set(['idea-suite', 'indesign', 'lightroom', 'db-tools', 'uiux-studio', 'web-dev-kit', 'dev-utils']);
  const currentProducts = storedProducts.filter(product => !removedDemoProductIds.has(product.id));
  const demoById = new Map(DEMO_PRODUCTS.map(p => [p.id, p]));
  let productsChanged = currentProducts.length !== storedProducts.length;
  const productsWithImages = currentProducts.map(product => {
    const bundled = demoById.get(product.id);
    const hasLegacyPhotoshopImages = /^photoshop(?:-|$)/i.test(product.id) &&
      product.images?.some(image => /assets\/photoshop(?:-detail)?\.jfif$|assets\/photoshop-logo\.png$/i.test(image));
    const hasLegacyAfterEffectsImage = /^after-effects(?:-|$)/i.test(product.id) &&
      product.images?.some(image => /assets\/after-effects(?:-logo)?\.(?:jfif|png)$|assets\/program-icon-video\.svg$/i.test(image));
    const hasLegacyIllustratorImage = /^illustrator(?:-|$)/i.test(product.id) &&
      product.images?.some(image => /assets\/illustrator\.jfif$|assets\/Ai\.png$/i.test(image));
    const hasLegacyPremiereImage = /^premiere-pro(?:-|$)/i.test(product.id) &&
      product.images?.some(image => /assets\/premiere-pro\.jfif$|assets\/Pr\.png$|assets\/program-icon-video\.svg$|assets\/program-icon-premiere\.svg$/i.test(image));
    const isAdobeCollection = /^adobe-(?:2021|2026)$/i.test(product.id);
    const isLightdoom = /^light-dom(?:-|$)/i.test(product.id);
    const needsAutoCADImages = product.id === 'autocad' &&
      (!product.images?.includes('assets/autocad-visualization.webp') || !product.images?.includes('assets/autocad-building.png'));
    const needsRevitImages = product.id === 'revit' &&
      (!product.images?.includes('assets/revit-project.jfif') || !product.images?.includes('assets/revit-design.jpg'));
    const needsLightdoomBranding = isLightdoom &&
      (product.name?.startsWith('Light Dom') || !product.images?.includes('assets/lightdoom-logo.svg'));
    const needsImages = bundled?.images?.length &&
      (!product.images?.length || hasLegacyPhotoshopImages || hasLegacyAfterEffectsImage || hasLegacyIllustratorImage || hasLegacyPremiereImage || needsAutoCADImages || needsRevitImages ||
        (isAdobeCollection && !product.images?.includes('assets/adobe-collection-logo.svg')) || needsLightdoomBranding);
    const needsVideos = bundled?.videos?.length && !product.videos?.length;
    const needsAfterEffectsPresentation = product.id === 'after-effects' &&
      (!product.featured || !product.popular);
    const needsAfterEffectsNaming = product.id === 'after-effects' &&
      product.name !== 'Adobe After Effects 2026';
    const needsIllustratorNaming = product.id === 'illustrator' &&
      product.name !== 'Adobe Illustrator 2026';
    const needsPremiereNaming = product.id === 'premiere-pro' &&
      product.name !== 'Adobe Premiere Pro 2026';
    const needsPhotoshopNaming = product.id === 'photoshop' && product.name !== 'Adobe Photoshop 2026';
    const lightdoomName = product.id === 'light-dom-2021' ? 'Lightdoom 2021' :
      product.id === 'light-dom-2023' ? 'Lightdoom 2023' : 'Lightdoom';
    if (needsImages || needsVideos || needsAfterEffectsPresentation || needsAfterEffectsNaming || needsIllustratorNaming || needsPremiereNaming || needsPhotoshopNaming || needsLightdoomBranding) {
      productsChanged = true;
      return {
        ...product,
        ...(needsImages ? { images: bundled.images } : {}),
        ...(needsVideos ? { videos: bundled.videos } : {}),
        ...(needsAfterEffectsPresentation ? { featured: true, popular: true } : {}),
        ...(needsAfterEffectsNaming ? { name: 'Adobe After Effects 2026', version: '2026', year: 2026 } : {}),
        ...(needsIllustratorNaming ? { name: 'Adobe Illustrator 2026', version: '2026', year: 2026 } : {}),
        ...(needsPremiereNaming ? { name: 'Adobe Premiere Pro 2026', version: '2026', year: 2026 } : {}),
        ...(needsPhotoshopNaming ? { name: 'Adobe Photoshop 2026', version: '2026', year: 2026 } : {}),
        ...(needsLightdoomBranding ? { name: lightdoomName, images: bundled.images } : {}),
      };
    }
    return product;
  });
  const photoshopIds = new Set(['photoshop-2021', 'photoshop-2023', 'photoshop']);
  const missingPhotoshopProducts = DEMO_PRODUCTS.filter(p => photoshopIds.has(p.id) &&
    !productsWithImages.some(existing => existing.id === p.id));
  if (missingPhotoshopProducts.length) {
    productsWithImages.push(...missingPhotoshopProducts);
    productsChanged = true;
  }
  const afterEffectsIds = new Set(['after-effects-2021', 'after-effects-2023', 'after-effects']);
  const missingAfterEffectsProducts = DEMO_PRODUCTS.filter(p => afterEffectsIds.has(p.id) &&
    !productsWithImages.some(existing => existing.id === p.id));
  if (missingAfterEffectsProducts.length) {
    productsWithImages.push(...missingAfterEffectsProducts);
    productsChanged = true;
  }
  const illustratorIds = new Set(['illustrator-2021', 'illustrator-2023', 'illustrator']);
  const missingIllustratorProducts = DEMO_PRODUCTS.filter(p => illustratorIds.has(p.id) &&
    !productsWithImages.some(existing => existing.id === p.id));
  if (missingIllustratorProducts.length) {
    productsWithImages.push(...missingIllustratorProducts);
    productsChanged = true;
  }
  const premiereIds = new Set(['premiere-pro-2021', 'premiere-pro-2023', 'premiere-pro']);
  const missingPremiereProducts = DEMO_PRODUCTS.filter(p => premiereIds.has(p.id) &&
    !productsWithImages.some(existing => existing.id === p.id));
  if (missingPremiereProducts.length) {
    productsWithImages.push(...missingPremiereProducts);
    productsChanged = true;
  }
  const missingDzingerIllusta = DEMO_PRODUCTS.find(p => p.id === 'dzinger-illusta' &&
    !productsWithImages.some(existing => existing.id === p.id));
  if (missingDzingerIllusta) {
    productsWithImages.push(missingDzingerIllusta);
    productsChanged = true;
  }
  const missingLightDom = DEMO_PRODUCTS.find(p => p.id === 'light-dom' &&
    !productsWithImages.some(existing => existing.id === p.id));
  if (missingLightDom) {
    productsWithImages.push(missingLightDom);
    productsChanged = true;
  }
  const lightDomIds = new Set(['light-dom-2021', 'light-dom-2023', 'light-dom']);
  const missingLightDomVersions = DEMO_PRODUCTS.filter(p => lightDomIds.has(p.id) &&
    !productsWithImages.some(existing => existing.id === p.id));
  if (missingLightDomVersions.length) {
    productsWithImages.push(...missingLightDomVersions);
    productsChanged = true;
  }
  const missingAutoCAD = DEMO_PRODUCTS.find(p => p.id === 'autocad' &&
    !productsWithImages.some(existing => existing.id === p.id));
  if (missingAutoCAD) {
    productsWithImages.push(missingAutoCAD);
    productsChanged = true;
  }
  const missingCovadis = DEMO_PRODUCTS.find(p => p.id === 'covadis' &&
    !productsWithImages.some(existing => existing.id === p.id));
  if (missingCovadis) {
    productsWithImages.push(missingCovadis);
    productsChanged = true;
  }
  const missingRevit = DEMO_PRODUCTS.find(p => p.id === 'revit' &&
    !productsWithImages.some(existing => existing.id === p.id));
  if (missingRevit) {
    productsWithImages.push(missingRevit);
    productsChanged = true;
  }
  const missing3dsMax = DEMO_PRODUCTS.find(p => p.id === '3ds-max' &&
    !productsWithImages.some(existing => existing.id === p.id));
  if (missing3dsMax) {
    productsWithImages.push(missing3dsMax);
    productsChanged = true;
  }
  if (productsChanged) LSset('products', productsWithImages);
  const currentCategories = LSget('categories', []);
  const categoriesWithBranding = currentCategories.map(category => {
    if (category.id === 'adobe' && !category.logo) {
      return { ...category, logo: 'assets/adobe-collection-logo.svg' };
    }
    if (category.id === 'engineering' && category.logo !== 'assets/software-engineering-logo.jfif') {
      return { ...category, logo: 'assets/software-engineering-logo.jfif' };
    }
    return category;
  });
  const missingCadCategory = DEMO_CATEGORIES.find(category => category.id === 'eng-cad' &&
    !categoriesWithBranding.some(existing => existing.id === category.id));
  if (missingCadCategory) categoriesWithBranding.push(missingCadCategory);
  if (categoriesWithBranding.some((category, index) => category !== currentCategories[index])) {
    LSset('categories', categoriesWithBranding);
  }
  const log = (action, details) => {
    const logs = LSget('logs', []);
    logs.unshift({ at: Date.now(), actor: session.email || 'system', action, details: details || '' });
    LSset('logs', logs.slice(0, 400));
  };
  const notify = (ouid, textKey, params) => {
    const ns = LSget('notifs', []);
    ns.unshift({ id: rid(), uid: ouid, text: textKey, params: params || {}, isRead: false, at: Date.now() });
    LSset('notifs', ns.slice(0, 200));
    window.dispatchEvent(new CustomEvent('etsy:notifs'));
  };
  const addEvent = (orderId, status, note) => {
    const ev = LSget('events', {});
    (ev[orderId] = ev[orderId] || []).push({ at: Date.now(), status, note: note || '', by: session.email || 'system' });
    LSset('events', ev);
  };
  const findOrder = (id) => LSget('orders', []).find(o => o.id === id);

  Object.assign(db, {
    /* ---- catalog ---- */
    products: {
      async list({ cat, q, sort = 'featured', includeUnlisted = false } = {}) {
        let arr = LSget('products', []).filter(p => includeUnlisted || p.listed !== false);
        if (cat) arr = arr.filter(p => p.cat === cat || p.category === cat);
        if (q) {
          const s = q.toLowerCase();
          arr = arr.filter(p => [p.name, p.desc, p.vendor].filter(Boolean).join(' ').toLowerCase().includes(s));
        }
        const cmp = {
          priceAsc: (a, b) => a.price - b.price,
          priceDesc: (a, b) => b.price - a.price,
          newest: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
          popular: (a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0) || (b.rating || 0) - (a.rating || 0),
          featured: (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.createdAt || 0) - (a.createdAt || 0),
        }[sort] || (() => 0);
        return arr.sort(cmp);
      },
      async get(id) { return LSget('products', []).find(p => p.id === id) || null; },
      async save(p) {
        const arr = LSget('products', []);
        if (p.id) { const i = arr.findIndex(x => x.id === p.id); if (i > -1) arr[i] = { ...arr[i], ...p }; }
        else { p.id = rid(); p.createdAt = Date.now(); arr.unshift(p); }
        LSset('products', arr); log('product.save', p.name || p.id);
        return p.id;
      },
      async remove(id) { LSset('products', LSget('products', []).filter(p => p.id !== id)); log('product.delete', id); },
    },
    categories: {
      async list() { return LSget('categories', []).sort((a, b) => (a.order || 0) - (b.order || 0)); },
      async get(id) { return LSget('categories', []).find(c => c.id === id) || null; },
      async save(c) {
        const arr = LSget('categories', []);
        if (c.id) { const i = arr.findIndex(x => x.id === c.id); if (i > -1) arr[i] = { ...arr[i], ...c }; }
        else { c.id = c.slug || rid(); arr.push(c); }
        LSset('categories', arr); log('category.save', c.id); return c.id;
      },
      async remove(id) { LSset('categories', LSget('categories', []).filter(c => c.id !== id && c.parent !== id)); log('category.delete', id); },
    },
    faq: {
      async list() { return LSget('faq', []).sort((a, b) => (a.order || 0) - (b.order || 0)); },
      async save(f) { const arr = LSget('faq', []); if (f.id) { const i = arr.findIndex(x => x.id === f.id); if (i > -1) arr[i] = { ...arr[i], ...f }; } else { f.id = rid(); arr.push(f); } LSset('faq', arr); return f.id; },
      async remove(id) { LSset('faq', LSget('faq', []).filter(f => f.id !== id)); },
    },
    coupons: {
      async list() { return LSget('coupons', []); },
      async validate(code, subtotal) {
        const c = LSget('coupons', []).find(x => x.code === String(code).toUpperCase() && x.active);
        if (!c || (c.expiresAt && c.expiresAt < Date.now()) || (c.maxUses && c.usedCount >= c.maxUses)) return { ok: false };
        const d = couponDiscount(c, subtotal);
        return d > 0 ? { ok: true, coupon: c, discount: d } : { ok: false };
      },
      async save(c) {
        const arr = LSget('coupons', []);
        if (c.id) { const i = arr.findIndex(x => x.id === c.id); if (i > -1) arr[i] = { ...arr[i], ...c }; }
        else { c.id = rid(); c.usedCount = 0; arr.push(c); }
        LSset('coupons', arr); log('coupon.save', c.code); return c.id;
      },
      async remove(id) { LSset('coupons', LSget('coupons', []).filter(c => c.id !== id)); },
    },
    settings: {
      async get() { return LSget('settings', DEMO_SETTINGS); },
      async save(section, data) {
        const s = LSget('settings', DEMO_SETTINGS); s[section] = { ...s[section], ...data };
        LSset('settings', s); log('settings.save', section); return s;
      },
    },

    /* ---- orders ---- */
    orders: {
      async create({ customer, items, paymentMethodId, couponCode }) {
        const products = LSget('products', []);
        const lines = items.map(it => {
          const p = products.find(x => x.id === it.id);
          if (!p) throw new Error('Unknown product in cart: ' + it.id);
          return { id: p.id, name: p.name, price: p.price, qty: it.qty, image: (p.images || [])[0] || null, cat: p.cat };
        });
        const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
        let discount = 0, coupon = null;
        if (couponCode) {
          const v = await db.coupons.validate(couponCode, subtotal);
          if (v.ok) {
            discount = v.discount; coupon = v.coupon.code;
            const cArr = LSget('coupons', []); const ci = cArr.findIndex(x => x.id === v.coupon.id);
            if (ci > -1) { cArr[ci].usedCount = (cArr[ci].usedCount || 0) + 1; LSset('coupons', cArr); }
          }
        }
        const order = {
          id: rid(), orderNumber: genOrderNumber(), uid: session.uid, customer,
          items: lines, subtotal, discount, couponCode: coupon, total: subtotal - discount,
          paymentMethodId, status: 'awaiting_payment', deliveryNote: '',
          receiptName: null, receiptData: null, receiptAt: null,
          createdAt: Date.now(), updatedAt: Date.now(),
        };
        const arr = LSget('orders', []); arr.unshift(order); LSset('orders', arr);
        addEvent(order.id, 'created', '');
        notify(session.uid, 'notif.orderCreated', { num: order.orderNumber });
        log('order.create', order.orderNumber + ' · ' + order.total + ' MAD');
        return { id: order.id, orderNumber: order.orderNumber, total: order.total };
      },
      async mine() { return LSget('orders', []).filter(o => o.uid === session.uid); },
      async get(id) {
        const o = findOrder(id);
        if (!o) return null;
        if (o.uid !== session.uid && !session.isAdmin) return null;
        return { ...o, timeline: LSget('events', {})[id] || [] };
      },
      async uploadReceipt(id, file) {
        const o = findOrder(id);
        if (!o || o.uid !== session.uid) throw new Error('Not your order');
        if (!['awaiting_payment', 'rejected'].includes(o.status)) throw new Error('Receipt already submitted');
        const data = await shrinkImage(file);
        const arr = LSget('orders', []);
        const i = arr.findIndex(x => x.id === id);
        arr[i] = { ...arr[i], status: 'under_review', receiptName: file.name, receiptData: data, receiptAt: Date.now(), updatedAt: Date.now() };
        LSset('orders', arr);
        addEvent(id, 'receipt', file.name);
        notify(o.uid, 'notif.receipt', { num: o.orderNumber });
        log('order.receipt', o.orderNumber);
        return arr[i];
      },
      async cancel(id) {
        const arr = LSget('orders', []);
        const i = arr.findIndex(x => x.id === id);
        if (i < 0 || (arr[i].uid !== session.uid && !session.isAdmin)) throw new Error('Not allowed');
        if (!['awaiting_payment', 'under_review', 'rejected'].includes(arr[i].status)) throw new Error('Cannot cancel');
        arr[i] = { ...arr[i], status: 'cancelled', updatedAt: Date.now() };
        LSset('orders', arr); addEvent(id, 'cancelled', '');
        notify(arr[i].uid, 'notif.cancelled', { num: arr[i].orderNumber });
        return arr[i];
      },
      /* admin */
      async listAll() { return LSget('orders', []).map(o => ({ ...o, timeline: [] })); },
      async review(id, { approve, reason }) {
        const arr = LSget('orders', []);
        const i = arr.findIndex(x => x.id === id);
        if (i < 0 || arr[i].status !== 'under_review') throw new Error('Order not reviewable');
        arr[i] = { ...arr[i], status: approve ? 'paid' : 'rejected', updatedAt: Date.now() };
        if (!approve) arr[i].rejectReason = reason || '';
        LSset('orders', arr);
        addEvent(id, approve ? 'paid' : 'rejected', reason || '');
        notify(arr[i].uid, approve ? 'notif.paid' : 'notif.rejected', { num: arr[i].orderNumber });
        log('order.review', `${arr[i].orderNumber} → ${approve ? 'paid' : 'rejected'}`);
        return arr[i];
      },
      async setStatus(id, status, note) {
        if (!['delivering', 'delivered', 'cancelled'].includes(status)) throw new Error('Bad status');
        const arr = LSget('orders', []);
        const i = arr.findIndex(x => x.id === id);
        if (i < 0) throw new Error('Not found');
        arr[i] = { ...arr[i], status, deliveryNote: note ?? arr[i].deliveryNote, updatedAt: Date.now() };
        LSset('orders', arr); addEvent(id, status, note || '');
        notify(arr[i].uid, 'notif.' + status, { num: arr[i].orderNumber });
        log('order.status', `${arr[i].orderNumber} → ${status}`);
        return arr[i];
      },
    },

    /* ---- users / customers (admin) ---- */
    users: {
      async save(uid, patch) {
        const arr = LSget('users', []);
        const i = arr.findIndex(u => u.uid === uid);
        if (i > -1) { arr[i] = { ...arr[i], ...patch }; LSset('users', arr); }
        log('user.save', uid);
      },
      async list() {
        const users = LSget('users', []).map(u => { const { password, ...safe } = u; return safe; });
        const orders = LSget('orders', []);
        return users.map(u => ({ ...u, ordersCount: orders.filter(o => o.uid === u.uid).length, spent: orders.filter(o => o.uid === u.uid && o.status !== 'cancelled').reduce((s, o) => s + o.total, 0) }));
      },
      async setRole(uid, role) {
        const arr = LSget('users', []);
        const i = arr.findIndex(u => u.uid === uid);
        if (i > -1) { arr[i].role = role; LSset('users', arr); }
        log('user.role', `${uid} → ${role}`);
        if (session.uid === uid) session.set({ ...session.snapshot(), role });
      },
    },

    /* ---- messages / reviews / notifications / logs ---- */
    messages: {
      async create(m) { const arr = LSget('msgs', []); arr.unshift({ id: rid(), ...m, status: 'new', at: Date.now() }); LSset('msgs', arr); log('message.create', m.subject || ''); },
      async list() { return LSget('msgs', []); },
      async markRead(id) { const arr = LSget('msgs', []); const i = arr.findIndex(m => m.id === id); if (i > -1) { arr[i].status = 'read'; LSset('msgs', arr); } },
    },
    reviews: {
      async list(productId) { return LSget('reviews', []).filter(r => r.productId === productId && r.approved); },
      async add(productId, { rating, text }) {
        const arr = LSget('reviews', []);
        arr.push({ id: rid(), productId, uid: session.uid, name: session.displayName || session.email, rating, text, approved: false, at: Date.now() });
        LSset('reviews', arr);
      },
      async listAll() { return LSget('reviews', []); },
      async approve(id) { const arr = LSget('reviews', []); const i = arr.findIndex(r => r.id === id); if (i > -1) { arr[i].approved = true; LSset('reviews', arr); log('review.approve', id); } },
      async remove(id) { LSset('reviews', LSget('reviews', []).filter(r => r.id !== id)); },
    },
    notifications: {
      async list() { return LSget('notifs', []).filter(n => n.uid === session.uid); },
      async markAll() { LSset('notifs', LSget('notifs', []).map(n => n.uid === session.uid ? { ...n, isRead: true } : n)); window.dispatchEvent(new CustomEvent('etsy:notifs')); },
      async unreadCount() { return LSget('notifs', []).filter(n => n.uid === session.uid && !n.isRead).length; },
    },
    logs: { async list() { return LSget('logs', []); }, add: log },

    /* ---- stats / storage ---- */
    async stats() {
      const orders = LSget('orders', []);
      const paid = orders.filter(o => ['paid', 'delivering', 'delivered'].includes(o.status));
      return {
        revenue: paid.reduce((s, o) => s + o.total, 0),
        ordersTotal: orders.length,
        pending: orders.filter(o => o.status === 'under_review').length,
        customers: LSget('users', []).filter(u => u.role !== 'admin').length,
        products: LSget('products', []).filter(p => p.listed !== false).length,
        orders: orders.slice(0, 8),
      };
    },
    storage: {
      async uploadProductImage(pid, file) { const d = await shrinkImage(file); return d || ''; },
      async uploadBanner(file) { const d = await shrinkImage(file, 1400); return d || ''; },
      async receiptUrl(order) { return order.receiptData || null; },
    },
  });
}

/* ======================================================= FIRESTORE BACKEND */
async function initFirestore() {
  await initFirebase();
  if (!fb.ready) throw new Error('Firebase failed to initialize');
  const { fsMod, fnMod, stMod } = fb.mods;
  const { fsdb, fns, storage } = fb;
  const F = fsMod, S = stMod;
  const wrap = async (p, map = r => r) => { const snap = await p; return snap.docs ? snap.docs.map(d => ({ id: d.id, ...d.data() })) : { id: snap.id, ...snap.data() }; };
  const call = async (name, data) => (await fnMod.httpsCallable(fns, name)(data)).data;
  const ts = v => (v?.toDate ? v.toDate().getTime() : v ?? null);
  const normOrder = o => ({ ...o, createdAt: ts(o.createdAt), updatedAt: ts(o.updatedAt), receiptAt: ts(o.receiptAt) });

  const log = (action, details) => F.addDoc(F.collection(fsdb, 'activityLogs'), { at: F.serverTimestamp(), actor: session.email || 'system', action, details: details || '' }).catch(console.error);

  Object.assign(db, {
    products: {
      async list({ cat, q, sort = 'featured', includeUnlisted = false } = {}) {
        let arr = await wrap(F.getDocs(includeUnlisted
          ? F.collection(fsdb, 'products')
          : F.query(F.collection(fsdb, 'products'), F.where('listed', '==', true))));
        if (cat) arr = arr.filter(p => p.cat === cat || p.category === cat);
        if (q) { const s = q.toLowerCase(); arr = arr.filter(p => [p.name, p.desc, p.vendor].filter(Boolean).join(' ').toLowerCase().includes(s)); }
        const cmp = {
          priceAsc: (a, b) => a.price - b.price, priceDesc: (a, b) => b.price - a.price,
          newest: (a, b) => ts(b.createdAt) - ts(a.createdAt),
          popular: (a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0) || (b.rating || 0) - (a.rating || 0),
          featured: (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || ts(b.createdAt) - ts(a.createdAt),
        }[sort] || (() => 0);
        return arr.sort(cmp);
      },
      async get(id) { const d = await F.getDoc(F.doc(fsdb, 'products', id)); return d.exists() ? { id: d.id, ...d.data() } : null; },
      async save(p) {
        const { id, ...data } = p;
        if (id) await F.setDoc(F.doc(fsdb, 'products', id), data, { merge: true });
        else { data.createdAt = F.serverTimestamp(); await F.setDoc(F.doc(F.collection(fsdb, 'products'), rid()), data); }
        log('product.save', p.name || id);
        return id || null;
      },
      async remove(id) { await F.deleteDoc(F.doc(fsdb, 'products', id)); log('product.delete', id); },
    },
    categories: {
      async list() { return (await wrap(F.getDocs(F.collection(fsdb, 'categories')))).sort((a, b) => (a.order || 0) - (b.order || 0)); },
      async get(id) { const d = await F.getDoc(F.doc(fsdb, 'categories', id)); return d.exists() ? { id: d.id, ...d.data() } : null; },
      async save(c) { const { id, ...data } = c; const ref = id ? F.doc(fsdb, 'categories', id) : F.doc(F.collection(fsdb, 'categories')); await F.setDoc(ref, data, { merge: true }); log('category.save', id || data.slug); return ref.id; },
      async remove(id) { await F.deleteDoc(F.doc(fsdb, 'categories', id)); log('category.delete', id); },
    },
    faq: {
      async list() { return (await wrap(F.getDocs(F.collection(fsdb, 'faq')))).sort((a, b) => (a.order || 0) - (b.order || 0)); },
      async save(f) { const { id, ...data } = f; const ref = id ? F.doc(fsdb, 'faq', id) : F.doc(F.collection(fsdb, 'faq')); await F.setDoc(ref, data, { merge: true }); return ref.id; },
      async remove(id) { await F.deleteDoc(F.doc(fsdb, 'faq', id)); },
    },
    coupons: {
      async list() { return wrap(F.getDocs(F.collection(fsdb, 'coupons'))); },
      async validate(code, subtotal) {
        try { const r = await call('validateCoupon', { code, subtotal }); return r; }
        catch { return { ok: false }; }
      },
      async save(c) {
        const { id, ...data } = c; const ref = id ? F.doc(fsdb, 'coupons', id) : F.doc(F.collection(fsdb, 'coupons'));
        await F.setDoc(ref, data, { merge: true }); log('coupon.save', c.code); return ref.id;
      },
      async remove(id) { await F.deleteDoc(F.doc(fsdb, 'coupons', id)); },
    },
    settings: {
      async get() {
        const [pay, home] = await Promise.all([
          F.getDoc(F.doc(fsdb, 'settings', 'payments')),
          F.getDoc(F.doc(fsdb, 'settings', 'homepage')),
        ]);
        return { payments: pay.exists() ? pay.data() : DEMO_SETTINGS.payments, homepage: home.exists() ? home.data() : DEMO_SETTINGS.homepage };
      },
      async save(section, data) { await F.setDoc(F.doc(fsdb, 'settings', section), data, { merge: true }); log('settings.save', section); },
    },

    orders: {
      async create(payload) { return call('createOrder', payload); }, // server-side price authority
      async mine() {
        const arr = await wrap(F.getDocs(F.query(F.collection(fsdb, 'orders'), F.where('uid', '==', session.uid), F.orderBy('createdAt', 'desc'), F.limit(100))));
        return arr.map(normOrder);
      },
      async get(id) {
        try {
          const d = await F.getDoc(F.doc(fsdb, 'orders', id));
          if (!d.exists()) return null;
          const events = await wrap(F.getDocs(F.query(F.collection(fsdb, 'orders', id, 'events'), F.orderBy('at'))));
          return { ...normOrder({ id: d.id, ...d.data() }), timeline: events.map(e => ({ ...e, at: ts(e.at) })) };
        } catch { return null; }
      },
      async uploadReceipt(id, file) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `receipts/${id}/receipt_${Date.now()}.${ext}`;
        await S.uploadBytes(S.ref(storage, path), file, { contentType: file.type });
        await F.updateDoc(F.doc(fsdb, 'orders', id), {
          status: 'under_review', receiptName: file.name, receiptPath: path, receiptAt: F.serverTimestamp(), updatedAt: F.serverTimestamp(),
        });
        await F.addDoc(F.collection(fsdb, 'orders', id, 'events'), { status: 'receipt', note: file.name, at: F.serverTimestamp(), by: session.uid });
        return { receiptPath: path };
      },
      async cancel(id) { return call('cancelOrder', { id }); },
      async listAll() {
        const arr = await wrap(F.getDocs(F.query(F.collection(fsdb, 'orders'), F.orderBy('createdAt', 'desc'), F.limit(200))));
        return arr.map(normOrder);
      },
      async review(id, decision) { return call('reviewPayment', { id, ...decision }); },
      async setStatus(id, status, note) { return call('updateOrderStatus', { id, status, note }); },
    },

    users: {
      async save(uid, patch) { await F.setDoc(F.doc(fsdb, 'users', uid), patch, { merge: true }); log('user.save', uid); },
      async list() {
        const users = (await wrap(F.getDocs(F.collection(fsdb, 'users')))).map(u => ({ ...u, createdAt: ts(u.createdAt) }));
        const orders = await wrap(F.getDocs(F.collection(fsdb, 'orders')));
        return users.map(u => ({ ...u, ordersCount: orders.filter(o => o.uid === u.uid).length, spent: orders.filter(o => o.uid === u.uid && !['cancelled', 'rejected', 'awaiting_payment'].includes(o.status)).reduce((s, o) => s + (o.total || 0), 0) }));
      },
      async setRole(uid, role) { await call('setAdminRole', { uid, role }); log('user.role', `${uid} → ${role}`); },
    },

    messages: {
      async create(m) { await F.addDoc(F.collection(fsdb, 'messages'), { ...m, status: 'new', at: F.serverTimestamp() }); },
      async list() { return (await wrap(F.getDocs(F.query(F.collection(fsdb, 'messages'), F.orderBy('at', 'desc'), F.limit(200))))).map(m => ({ ...m, at: ts(m.at) })); },
      async markRead(id) { await F.updateDoc(F.doc(fsdb, 'messages', id), { status: 'read' }); },
    },
    reviews: {
      async list(productId) { return wrap(F.getDocs(F.query(F.collection(fsdb, 'reviews'), F.where('productId', '==', productId), F.where('approved', '==', true)))); },
      async add(productId, { rating, text }) {
        await F.addDoc(F.collection(fsdb, 'reviews'), { productId, uid: session.uid, name: session.displayName || session.email, rating, text, approved: false, at: F.serverTimestamp() });
      },
      async listAll() { return (await wrap(F.getDocs(F.query(F.collection(fsdb, 'reviews'), F.limit(200))))).map(r => ({ ...r, at: ts(r.at) })); },
      async approve(id) { await F.updateDoc(F.doc(fsdb, 'reviews', id), { approved: true }); log('review.approve', id); },
      async remove(id) { await F.deleteDoc(F.doc(fsdb, 'reviews', id)); },
    },
    notifications: {
      async list() { return (await wrap(F.getDocs(F.query(F.collection(fsdb, 'notifications'), F.where('uid', '==', session.uid), F.orderBy('createdAt', 'desc'), F.limit(50))))).map(n => ({ ...n, at: ts(n.createdAt) ?? ts(n.at) })); },
      async markAll() {
        const arr = await wrap(F.getDocs(F.query(F.collection(fsdb, 'notifications'), F.where('uid', '==', session.uid), F.where('isRead', '==', false), F.limit(50))));
        await Promise.all(arr.map(n => F.updateDoc(F.doc(fsdb, 'notifications', n.id), { isRead: true })));
      },
      async unreadCount() {
        try { const arr = await wrap(F.getDocs(F.query(F.collection(fsdb, 'notifications'), F.where('uid', '==', session.uid), F.where('isRead', '==', false), F.limit(10)))); return arr.length; }
        catch { return 0; }
      },
    },
    logs: {
      async list() { return (await wrap(F.getDocs(F.query(F.collection(fsdb, 'activityLogs'), F.orderBy('at', 'desc'), F.limit(200))))).map(l => ({ ...l, at: ts(l.at) })); },
      add: log,
    },
    async stats() {
      const [orders, products, users] = await Promise.all([
        wrap(F.getDocs(F.query(F.collection(fsdb, 'orders'), F.orderBy('createdAt', 'desc'), F.limit(300)))),
        wrap(F.getDocs(F.collection(fsdb, 'products'))),
        wrap(F.getDocs(F.collection(fsdb, 'users'))),
      ]);
      const norm = orders.map(normOrder);
      return {
        revenue: norm.filter(o => ['paid', 'delivering', 'delivered'].includes(o.status)).reduce((s, o) => s + o.total, 0),
        ordersTotal: norm.length,
        pending: norm.filter(o => o.status === 'under_review').length,
        customers: users.filter(u => u.role !== 'admin').length,
        products: products.filter(p => p.listed !== false).length,
        orders: norm.slice(0, 8),
      };
    },
    storage: {
      async uploadProductImage(pid, file) {
        const path = `products/${pid}/${rid()}_${file.name}`.replace(/\s+/g, '_');
        const r = S.ref(storage, path);
        await S.uploadBytes(r, file, { contentType: file.type });
        return S.getDownloadURL(r);
      },
      async uploadBanner(file) {
        const path = `banners/${rid()}_${file.name}`.replace(/\s+/g, '_');
        const r = S.ref(storage, path);
        await S.uploadBytes(r, file, { contentType: file.type });
        return S.getDownloadURL(r);
      },
      async receiptUrl(order) { try { return order.receiptPath ? await S.getDownloadURL(S.ref(storage, order.receiptPath)) : null; } catch { return null; } },
    },
  });
}

export async function initDb() {
  if (IS_DEMO) initDemo();
  else { try { await initFirestore(); } catch (e) { console.error(e); throw e; } }
}
