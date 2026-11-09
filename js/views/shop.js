/* views/shop.js — homepage, catalog, category, product details, search */
import { icon } from '../icons.js';
import { t, lang } from '../i18n.js';
import { esc, $, $$, money, dateFmt, setMeta } from '../utils.js';
import { db } from '../db.js';
import { cart, wish, recent } from '../cart.js';
import { session } from '../session.js';
import { productCard, skeletonGrid, emptyState, catLabel, starsRow, toast, revealInit } from '../ui.js';
import { BRAND, isAdobeProduct } from '../config.js';
import { createHero3D } from '../hero3d.js';

const grid = (arr) => arr.map(productCard).join('');

// Keep the homepage focused: show only the newest release from each product family.
// The full catalog still contains every release.
function latestReleasePerProduct(products) {
  const families = new Map();
  products.forEach(product => {
    const family = String(product.id || '').replace(/-(2021|2023|2026)$/i, '');
    const current = families.get(family);
    if (!current || (product.year || 0) > (current.year || 0) ||
      ((product.year || 0) === (current.year || 0) && (product.createdAt || 0) > (current.createdAt || 0))) {
      families.set(family, product);
    }
  });
  return [...families.values()];
}

/* =============================================================== HOMEPAGE */
export const homeView = {
  titleKey: 'nav.home',
  async render(app) {
    app.innerHTML = skeletonGrid(4);
    const [settings, products, categories] = await Promise.all([
      db.settings.get(), db.products.list({ sort: 'featured' }), db.categories.list(),
    ]);
    const hp = settings.homepage || {};
    const homepageProducts = latestReleasePerProduct(products);
    const tops = categories.filter(c => !c.parent);
    const heroProducts = homepageProducts.filter(p => p.featured || p.popular).slice(0, 8);
    const demoNote = products.some(p => p.demo) ? `<div class="container"><div class="alert alert--warning" style="margin-top:18px">${icon('alert')}<span>${esc(t('common.demoNotice'))}</span></div></div>` : '';

    /* spotlight pick: most popular Adobe product, else first featured */
    const spotlight = homepageProducts.find(p => p.popular && isAdobeProduct(p))
      || homepageProducts.find(p => p.featured) || homepageProducts[0];
    const spotImg = spotlight && (spotlight.images || [])[0];
    const spotFeatures = (spotlight?.features || []).slice(0, 4);
    const spotHref = spotlight ? `#/product/${esc(spotlight.id)}` : '#/catalog';

    app.innerHTML = `
    <section class="hero3d" id="hero3d" aria-label="ROVZEXI cinematic intro">
      <div class="hero3d-host" id="hero3d-host"></div>
      <div class="hero3d-vignette" aria-hidden="true"></div>
      <div class="hero3d-fallback" id="hero3d-fallback" aria-hidden="true">
        <div class="hf-orb hf-orb--1"></div><div class="hf-orb hf-orb--2"></div>
        <div class="hf-grid"></div><div class="hf-ring"></div>
      </div>
      <div class="hero3d-overlay container">
        <span class="hero-eyebrow hero3d-fx"><span class="pulse-dot"></span>${esc(hp.announce || t('home.eyebrow'))}</span>
        <h1 class="hero3d-title hero3d-fx">
          <span class="line">${esc(hp.heroTitleA || t('home.title1'))}</span>
          <span class="line grad-text">${esc(hp.heroTitleB || t('home.title2'))}</span>
        </h1>
        <p class="lead hero3d-fx">${esc(hp.heroSubtitle || t('home.lead'))}</p>
        <div class="hero-cta hero3d-fx">
          <a class="btn btn--primary btn--lg" href="#/catalog">${icon('grid')}${esc(t('home.browse'))}</a>
          <a class="btn btn--ghost btn--lg" href="#/category/adobe">${icon('layers')}${esc(t('home.exploreAdobe'))}</a>
        </div>
        <div class="hero3d-stats hero3d-fx">
          <div class="stat"><b class="grad-text">${homepageProducts.length}+</b><span>${esc(t('home.statProducts'))}</span></div>
          <div class="stat"><b class="grad-text">${tops.length}</b><span>${esc(t('home.statCategories'))}</span></div>
          <div class="stat"><b>100%</b><span>${esc(t('home.statVerified'))}</span></div>
          <div class="stat"><b>24/7</b><span>${esc(t('home.statSupport'))}</span></div>
        </div>
        <div class="hero3d-hints hero3d-fx" id="hero3d-hints">
          <span class="hint">${icon('hand')} ${esc(t('home.holdHint'))}</span>
          <span class="hint hint--scroll">${esc(t('home.scrollHint'))}<span class="scroll-line"></span></span>
        </div>
      </div>
      <div class="hero3d-tip" id="hero3d-tip" hidden></div>
    </section>
    ${demoNote}

    <section class="section" style="padding-top:40px">
      <div class="container">
        <div class="trust-strip">
          ${[['shieldCheck', 'trust.verified'], ['lock', 'trust.secure'], ['message', 'trust.support'], ['zap', 'trust.delivery']].map(([ic, k]) => `
            <div class="trust-item reveal"><span class="ti-icon">${icon(ic)}</span>
              <div><b>${esc(t(k + '.title'))}</b><span>${esc(t(k + '.desc'))}</span></div></div>`).join('')}
        </div>
      </div>
    </section>

    ${spotlight ? `
    <section class="section" style="padding-top:0">
      <div class="container">
        <div class="section-head"><div><div class="kicker">${esc(t('home.spotlightKicker'))}</div><h2>${esc(t('home.spotlight'))}</h2></div></div>
        <div class="spotlight reveal">
          <a class="spotlight-media" href="${spotHref}" aria-label="${esc(spotlight.name)}">
            ${spotImg ? `<img src="${esc(spotImg)}" alt="${esc(spotlight.name)}" loading="lazy" />` : icon('box')}
            <span class="spotlight-glow" aria-hidden="true"></span>
          </a>
          <div class="spotlight-body">
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              ${spotlight.popular ? '<span class="tag tag--hot">HOT</span>' : ''}
              <span class="p-cat">${esc(t('cat.adobe.title'))}</span>
            </div>
            <h3>${esc(spotlight.name)}</h3>
            <p class="spotlight-desc">${esc(spotlight.desc || '')}</p>
            <ul class="spotlight-features">${spotFeatures.map(f => `<li>${icon('check')}<span>${esc(f)}</span></li>`).join('')}</ul>
            <div class="spotlight-actions">
              <a class="btn btn--primary btn--lg" href="${spotHref}">${icon('zap')}${esc(t('home.viewProduct'))}</a>
              ${isAdobeProduct(spotlight)
                ? `<a class="btn btn--ghost btn--lg btn--whatsapp" href="https://wa.me/${esc(BRAND.whatsappNumber)}?text=${encodeURIComponent('Hello Legendar, I want to ask about: ' + spotlight.name)}" target="_blank" rel="noopener">${icon('whatsapp')}WhatsApp</a>`
                : ''}
            </div>
          </div>
        </div>
      </div>
    </section>` : ''}

    <section class="section">
      <div class="container">
        <div class="section-head">
          <div><div class="kicker">${esc(t('home.categories'))}</div><h2>${esc(t('home.categoriesSub'))}</h2></div>
        </div>
        <div class="grid grid--cats">
          ${tops.map(c => `
            <a class="cat-card reveal" href="#/category/${esc(c.id)}">
              <div class="cat-bg">${c.logo ? `<img src="${esc(c.logo)}" alt="${esc(catLabel(c))}" />` : icon(c.icon || 'grid')}</div>
              <div class="cat-body">
                <span class="cat-icon">${c.logo ? `<img src="${esc(c.logo)}" alt="" />` : icon(c.icon || 'grid')}</span>
                <h3>${esc(catLabel(c))}</h3>
                <p>${esc(c.desc || '')}</p>
                <span class="cat-count">${icon('arrowR')} ${products.filter(p => p.cat === c.id).length} ${esc(t('home.statProducts').toLowerCase())}</span>
              </div>
            </a>`).join('')}
        </div>
      </div>
    </section>

    <section class="section" style="padding-top:0">
      <div class="container">
        <div class="section-head"><div><div class="kicker">${esc(t('home.howItWorks'))}</div><h2>3 ${esc(t('common.continue'))}…</h2></div></div>
        <div class="grid grid--4">
          ${[1, 2, 3].map(i => `
            <div class="trust-item reveal">
              <span class="ti-icon" style="font-family:var(--font-display);font-weight:700;color:#c4b5fd;font-size:1.2rem">${i}</span>
              <div><b>${esc(t('home.how' + i))}</b><span>${esc(t('home.how' + i + 'd'))}</span></div>
            </div>`).join('')}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="cta-band reveal">
          <h2>${esc(t('home.ctaTitle'))}</h2>
          <p>${esc(t('home.ctaSub'))}</p>
          <a class="btn btn--primary btn--lg" href="#/register">${icon('zap')}${esc(t('home.ctaBtn'))}</a>
        </div>
      </div>
    </section>`;

    revealInit(app);

    /* ---- mount the 3D universe (fallback stays hidden behind it on success) */
    const host = $('#hero3d-host');
    const tip = $('#hero3d-tip');
    if (host) {
      const onNavigate = (p) => { if (p?.id) location.hash = `#/product/${p.id}`; };
      const onHover = (p) => {
        if (!tip) return;
        if (!p) { tip.hidden = true; return; }
        tip.hidden = false;
        tip.textContent = p.name;
      };
      const scene = await createHero3D(host, { products: heroProducts, onNavigate, onHover });
      if (!scene) document.getElementById('hero3d')?.classList.add('hero3d--fallback');
      else document.getElementById('hero3d')?.classList.add('hero3d--live');
      document.getElementById('hero3d')?.classList.add('hero3d--ready');
    }
  },
};

/* =============================================================== CATALOG */
function filtersHTML(categories, state) {
  const tops = categories.filter(c => !c.parent);
  const subs = categories.filter(c => c.parent === (state.cat || ''));
  return `
  <aside class="filters" id="filters">
    <h4>${esc(t('catalog.category'))}</h4>
    <div class="filter-group chip-row" data-filter="cat">
      <button class="chip${!state.cat ? ' on' : ''}" data-v="">${esc(t('common.all'))}</button>
      ${tops.map(c => `<button class="chip${state.cat === c.id ? ' on' : ''}" data-v="${esc(c.id)}">${esc(catLabel(c))}</button>`).join('')}
    </div>
    ${subs.length ? `
    <h4>↳ ${esc(t('catalog.category'))}</h4>
    <div class="filter-group chip-row" data-filter="sub">
      ${subs.map(c => `<button class="chip${state.sub === c.id ? ' on' : ''}" data-v="${esc(c.id)}">${esc(catLabel(c))}</button>`).join('')}
    </div>` : ''}
    <h4>${esc(t('catalog.priceRange'))}</h4>
    <div class="filter-group">
      <input class="input" id="f-min" type="number" min="0" placeholder="0" value="${state.min ?? ''}" aria-label="min" />
      <input class="input" id="f-max" type="number" min="0" placeholder="∞" value="${state.max ?? ''}" aria-label="max" />
    </div>
    <h4>${esc(t('catalog.availability'))}</h4>
    <div class="filter-group chip-row" data-filter="stock">
      <button class="chip${state.stock == null ? ' on' : ''}" data-v="">${esc(t('common.all'))}</button>
      <button class="chip${state.stock === 'in' ? ' on' : ''}" data-v="in">${esc(t('common.inStock'))}</button>
      <button class="chip${state.stock === 'out' ? ' on' : ''}" data-v="out">${esc(t('common.outOfStock'))}</button>
    </div>
    <button class="btn btn--ghost btn--sm btn--block" id="f-reset" style="margin-top:16px">${icon('refresh')}${esc(t('common.reset'))}</button>
  </aside>`;
}

export function mountCatalog(app, { title, lead, baseCat, query }) {
  const state = {
    cat: baseCat || query.cat || '', sub: query.sub || '',
    min: query.min ? +query.min : null, max: query.max ? +query.max : null,
    stock: query.stock || null, q: query.q || '',
    sort: query.sort || 'featured',
  };
  app.innerHTML = `
  <div class="container">
    <div class="page-head"><h1>${esc(title)}</h1><p class="lead">${esc(lead)}</p></div>
    <div class="catalog-layout">
      <div id="filters-slot"></div>
      <div>
        <div class="toolbar">
          <span class="result-count" id="result-count"></span>
          <select class="select" id="sort-sel" aria-label="${esc(t('catalog.sort'))}">
            ${['featured', 'priceAsc', 'priceDesc', 'newest', 'popular'].map(s =>
              `<option value="${s}"${state.sort === s ? ' selected' : ''}>${esc(t('catalog.sort.' + s))}</option>`).join('')}
          </select>
        </div>
        <div id="catalog-results">${skeletonGrid(6)}</div>
      </div>
    </div>
  </div>`;

  async function refresh() {
    $('#catalog-results').innerHTML = skeletonGrid(6);
    const categories = await db.categories.list();
    $('#filters-slot').innerHTML = filtersHTML(categories, state);
    let products = await db.products.list({ cat: state.sub || state.cat || '', q: state.q, sort: state.sort });
    if (state.min != null) products = products.filter(p => p.price >= state.min);
    if (state.max != null) products = products.filter(p => p.price <= state.max);
    if (state.stock === 'in') products = products.filter(p => p.stock !== false);
    if (state.stock === 'out') products = products.filter(p => p.stock === false);
    $('#result-count').textContent = `${products.length} ${t('common.results')}`;
    $('#catalog-results').innerHTML = products.length
      ? `<div class="grid grid--products">${grid(products)}</div>`
      : '';
    if (!products.length) {
      $('#catalog-results').append(emptyState({
        ic: 'search', title: t('catalog.empty'), text: t('catalog.emptyHint'),
        ctaLabel: t('common.reset'),
      }));
      $('#catalog-results .btn').onclick = () => { Object.assign(state, { cat: baseCat, sub: '', min: null, max: null, stock: null, q: '' }); refresh(); };
    }
    /* wire filters */
    $$('#filters-slot [data-filter]').forEach(group => group.querySelectorAll('.chip').forEach(chip => {
      chip.onclick = () => {
        const key = group.dataset.filter, v = chip.dataset.v;
        if (key === 'cat') { state.cat = v; state.sub = ''; }
        else if (key === 'stock') state.stock = v || null;
        else state.sub = v;
        refresh();
      };
    }));
    const applyPrice = () => {
      state.min = $('#f-min').value ? +$('#f-min').value : null;
      state.max = $('#f-max').value ? +$('#f-max').value : null;
      refresh();
    };
    $('#f-min').onchange = applyPrice; $('#f-max').onchange = applyPrice;
    $('#f-reset').onclick = () => { Object.assign(state, { cat: baseCat || '', sub: '', min: null, max: null, stock: null, q: '' }); refresh(); };
    revealInit(app);
  }
  $('#sort-sel').onchange = e => { state.sort = e.target.value; refresh(); };
  refresh();
}

export const catalogView = {
  titleKey: 'catalog.title',
  descKey: 'catalog.lead',
  render(app, params, query) { return mountCatalog(app, { title: t('catalog.title'), lead: t('catalog.lead'), query }); },
};

export const categoryView = {
  async render(app, params, query) {
    const c = await db.categories.get(params.id);
    const title = c ? catLabel(c) : params.id;
    document.title = `Legendar — ${title}`;
    return mountCatalog(app, { title, lead: c?.desc || t('catalog.lead'), baseCat: params.id, query });
  },
};

export const searchView = {
  async render(app, params, query) {
    const q = (query.q || '').trim();
    document.title = `Legendar — ${t('search.title')}: ${q}`;
    app.innerHTML = `
    <div class="container">
      <div class="page-head"><h1>${esc(t('search.for', { q }))}</h1></div>
      <form id="search-page-form" class="searchbar" style="max-width:560px;margin:0 auto 34px">
        ${icon('search')}<input class="input" type="search" id="search-page-input" value="${esc(q)}" placeholder="${esc(t('nav.search'))}" aria-label="${esc(t('common.search'))}" />
      </form>
      <div id="search-results">${skeletonGrid(4)}</div>
    </div>`;
    $('#search-page-form').onsubmit = e => {
      e.preventDefault();
      const v = $('#search-page-input').value.trim();
      if (v) location.hash = `#/search?q=${encodeURIComponent(v)}`;
    };
    const products = q ? await db.products.list({ q }) : [];
    $('#search-results').innerHTML = products.length
      ? `<div class="grid grid--products">${grid(products)}</div>`
      : '';
    if (!q || !products.length) {
      $('#search-results').append(emptyState({ ic: 'search', title: t('search.empty', { q: q || '…' }), text: t('search.emptyHint'), ctaLabel: t('home.browse'), ctaHref: '#/catalog' }));
    }
    revealInit(app);
  },
};

/* ========================================================= PRODUCT DETAIL */
export const productView = {
  async render(app, params) {
    app.innerHTML = skeletonGrid(2);
    const p = await db.products.get(params.id);
    if (!p) {
      app.innerHTML = `<div class="container section">${''}</div>`;
      app.append(emptyState({ ic: 'box', title: t('pdp.notFound'), text: t('404.lead'), ctaLabel: t('404.btn'), ctaHref: '#/' }));
      return;
    }
    recent.push(p.id);
    document.title = `Legendar — ${p.name}`;
    setMeta('description', String(p.desc || '').slice(0, 155));
    setMeta('og:title', `Legendar — ${p.name}`, 'property');

    const [cat, reviewsP, relatedP] = await Promise.all([
      db.categories.get(p.category || p.cat || ''), db.reviews.list(p.id),
      db.products.list({ cat: p.cat || p.category }),
    ]);
    const related = relatedP.filter(x => x.id !== p.id).slice(0, 4);
    const productFamily = String(p.id || '').replace(/-(2021|2023|2026)$/i, '');
    const versions = relatedP
      .filter(x => String(x.id || '').replace(/-(2021|2023|2026)$/i, '') === productFamily)
      .sort((a, b) => (b.year || 0) - (a.year || 0));
    const images = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    const videos = Array.isArray(p.videos) ? p.videos.filter(Boolean) : [];
    const media = [
      ...images.map(src => ({ type: 'image', src })),
      ...videos.map(src => ({ type: 'video', src })),
    ];
    const mediaMarkup = item => item.type === 'video'
      ? `<video id="gal-main" src="${esc(item.src)}" controls playsinline preload="metadata" aria-label="${esc(p.name)} tutorial video"></video>`
      : `<img id="gal-main" src="${esc(item.src)}" alt="${esc(p.name)}" />`;
    const rating = reviewsP.length ? reviewsP.reduce((s, r) => s + r.rating, 0) / reviewsP.length : (p.rating || 0);
    const inStock = p.stock !== false;

    /* JSON-LD structured data */
    document.getElementById('ld-json')?.remove();
    const ld = document.createElement('script');
    ld.type = 'application/ld+json'; ld.id = 'ld-json';
    ld.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: (p.desc || '').slice(0, 300), brand: { '@type': 'Brand', name: p.vendor || 'Legendar' }, offers: { '@type': 'Offer', price: p.price, priceCurrency: 'MAD', availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } });
    document.head.append(ld);

    app.innerHTML = `
    <div class="container" style="padding-top:26px">
      <nav class="breadcrumbs" aria-label="breadcrumb">
        <a href="#/">${esc(t('nav.home'))}</a>${icon('chevronR')}
        <a href="#/catalog">${esc(t('nav.catalog'))}</a>${icon('chevronR')}
        <a href="#/category/${esc(p.cat || '')}">${esc(p.cat === 'adobe' ? t('cat.adobe.title') : p.cat === 'engineering' ? t('cat.eng.title') : p.cat)}</a>${icon('chevronR')}
        <span>${esc(p.name)}</span>
      </nav>

      <div class="product-layout">
        <div>
          <div class="gallery-main${media.length ? '' : ' gallery-main--empty'}">${media.length ? mediaMarkup(media[0]) : ''}</div>
          ${media.length > 1 ? `<div class="gallery-thumbs">${media.map((item, i) => `
            <button class="${i === 0 ? 'on' : ''}" data-img="${esc(item.src)}" data-media-type="${item.type}" aria-label="${item.type === 'video' ? 'tutorial video' : `image ${i + 1}`}" >${item.type === 'video' ? `<video src="${esc(item.src)}" muted preload="metadata"></video><span class="gallery-video-badge">▶</span>` : `<img src="${esc(item.src)}" alt="" loading="lazy" />`}</button>`).join('')}</div>` : ''}
        </div>

        <div class="pdp-info">
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            ${p.demo ? '<span class="tag tag--demo">DEMO</span>' : ''}
            ${p.popular ? '<span class="tag tag--hot">HOT</span>' : ''}
            <span class="p-cat">${esc(cat ? catLabel(cat) : (p.cat || ''))}</span>
          </div>
          <h1>${esc(p.name)}</h1>
          <div class="pdp-meta">
            ${p.vendor ? `<span>${icon('tag')}${esc(p.vendor)}</span>` : ''}
            ${p.version ? `<span>${icon('layers')}${esc(t('common.version'))} ${esc(p.version)}</span>` : ''}
            ${p.year ? `<span>${icon('calendar')}${esc(p.year)}</span>` : ''}
            <span>${icon('star')} ${starsRow(rating, reviewsP.length || null)}</span>
          </div>
          <p class="muted">${esc(p.desc || '')}</p>

          ${versions.length ? `<div class="version-picker">
            <div class="version-picker__label">${icon('layers')}<b>${esc(t('pdp.versions'))}</b></div>
            <div class="version-picker__options">${[p, ...versions].filter((item, index, all) => all.findIndex(x => x.id === item.id) === index).sort((a, b) => (b.year || 0) - (a.year || 0)).map(item => `
              <a class="version-option${item.id === p.id ? ' is-current' : ''}" href="#/product/${esc(item.id)}">
                <span>${esc(item.name)}</span><small>${isAdobeProduct(item) ? 'WhatsApp' : money(item.price, lang())}</small>
              </a>`).join('')}</div>
          </div>` : ''}

          <div class="pdp-price-row">
            <div>
              ${isAdobeProduct(p)
                ? `<div class="pdp-contact-price">${icon('whatsapp')} Contact via WhatsApp</div>`
                : `<div class="pdp-price">${money(p.price, lang())}</div>${p.compareAt && p.compareAt > p.price ? `<span class="faint" style="text-decoration:line-through">${money(p.compareAt, lang())}</span>` : ''}`}
            </div>
            <span class="stock-pill ${inStock ? 'stock-pill--in' : 'stock-pill--out'}"><span class="dot"></span>${esc(t(inStock ? 'common.inStock' : 'common.outOfStock'))}</span>
          </div>

          <div class="qty-row">
            <div class="qty">
              <button id="q-minus" aria-label="-">${icon('minus')}</button>
              <b id="qty-val">1</b>
              <button id="q-plus" aria-label="+">${icon('plus')}</button>
            </div>
            <button class="p-wish${wish.has(p.id) ? ' on' : ''}" data-wish="${esc(p.id)}" style="position:static;width:48px;height:48px" aria-label="${esc(t('nav.wishlist'))}">${icon('heart')}</button>
          </div>

          <div class="pdp-actions">
            ${isAdobeProduct(p)
              ? `<a class="btn btn--primary btn--lg btn--whatsapp" href="https://wa.me/${esc(BRAND.whatsappNumber)}?text=${encodeURIComponent('Hello Legendar, I want to ask about: ' + p.name)}" target="_blank" rel="noopener">${icon('whatsapp')}Contact via WhatsApp</a>`
              : `<button class="btn btn--primary btn--lg" id="pd-buy" ${inStock ? '' : 'disabled'}>${icon('zap')}${esc(t('common.buyNow'))}</button><button class="btn btn--ghost btn--lg" id="pd-cart" ${inStock ? '' : 'disabled'}>${icon('cart')}${esc(t('common.addToCart'))}</button>`}
          </div>

          <a class="wa-support" href="https://wa.me/${esc(BRAND.whatsappNumber)}?text=${encodeURIComponent('Hello Legendar, I have a question about: ' + p.name)}" target="_blank" rel="noopener">
            ${icon('whatsapp')} <span>${esc(t('contact.whatsapp'))} — ${esc(t('contact.whatsappAvail'))}</span>
          </a>
        </div>
      </div>

      <div class="tabs">
        <div class="tab-bar" role="tablist">
          <button class="on" data-tab="desc">${esc(t('pdp.description'))}</button>
          <button data-tab="features">${esc(t('pdp.features'))}</button>
          <button data-tab="specs">${esc(t('pdp.specs'))}</button>
          <button data-tab="faq">${esc(t('pdp.faq'))}</button>
          <button data-tab="reviews">${esc(t('pdp.reviews'))} (${reviewsP.length})</button>
        </div>
        <div class="tab-panel" id="tab-desc">
          <div class="prose"><p>${esc(p.desc || '')}</p>
          ${p.demo ? `<div class="alert alert--warning" style="margin-top:16px">${icon('alert')}<span>${esc(t('common.demoNotice'))}</span></div>` : ''}</div>
        </div>
        <div class="tab-panel hidden" id="tab-features">
          <ul class="feature-list">${(p.features || []).map(f => `<li>${icon('check')}<span>${esc(f)}</span></li>`).join('') || `<li class="muted">—</li>`}</ul>
        </div>
        <div class="tab-panel hidden" id="tab-specs">
          <table class="spec-table"><tbody>
            <tr><td>${esc(t('common.version'))}</td><td>${esc(p.version || '—')}</td></tr>
            <tr><td>${esc(t('common.year'))}</td><td>${esc(p.year || '—')}</td></tr>
            <tr><td>${esc(t('pdp.license'))}</td><td>${esc(p.licenseType || '—')}</td></tr>
            <tr><td>${esc(t('pdp.validity'))}</td><td>${esc(p.validity || '—')}</td></tr>
            <tr><td>${esc(t('pdp.delivery'))}</td><td>${esc(p.delivery || '—')}</td></tr>
            <tr><td>${esc(t('pdp.os'))}</td><td><div class="os-pills">${(p.os || []).map(o => `<span class="os-pill">${icon('monitor')}${esc(o)}</span>`).join('') || '—'}</div></td></tr>
            <tr><td>${esc(t('pdp.requirements'))}</td><td>${esc(p.requirements || '—')}</td></tr>
            <tr><td>${esc(t('pdp.availability'))}</td><td>${esc(t(inStock ? 'common.inStock' : 'common.outOfStock'))}</td></tr>
          </tbody></table>
        </div>
        <div class="tab-panel hidden" id="tab-faq">
          ${(p.faq || []).map(f => `<details class="faq-acc"><summary>${esc(f.q)}</summary><div class="faq-body">${esc(f.a)}</div></details>`).join('') || `<p class="muted">—</p>`}
        </div>
        <div class="tab-panel hidden" id="tab-reviews">
          <div id="reviews-list">${reviewsP.map(r => `
            <div class="review"><div class="review-head">
              <span class="avatar" style="width:30px;height:30px;font-size:.75rem">${esc((r.name || '?')[0].toUpperCase())}</span>
              <div><b style="font-size:.9rem">${esc(r.name || '—')}</b><br>${starsRow(r.rating)}</div>
              <time>${esc(dateFmt(r.at, lang()))}</time></div>
              <p class="muted" style="font-size:.9rem">${esc(r.text)}</p></div>`).join('') || `<p class="muted">${esc(t('pdp.noReviews'))}</p>`}
          </div>
          <div id="review-form-slot" style="margin-top:26px"></div>
        </div>
      </div>

      ${related.length ? `
      <section class="section">
        <div class="section-head"><div><div class="kicker">${esc(t('pdp.related'))}</div></div></div>
        <div class="grid grid--products">${grid(related)}</div>
      </section>` : ''}
    </div>`;

    /* gallery */
    $$('.gallery-thumbs button').forEach(b => b.onclick = () => {
      const main = $('#gal-main');
      const next = b.dataset.mediaType === 'video'
        ? document.createElement('video')
        : document.createElement('img');
      next.id = 'gal-main';
      next.src = b.dataset.img;
      next.className = main?.className || '';
      if (b.dataset.mediaType === 'video') {
        next.controls = true; next.playsInline = true; next.preload = 'metadata';
        next.setAttribute('aria-label', `${p.name} tutorial video`);
      } else {
        next.alt = p.name;
      }
      main?.replaceWith(next);
      $$('.gallery-thumbs button').forEach(x => x.classList.remove('on')); b.classList.add('on');
    });
    /* qty */
    let qty = 1;
    $('#q-minus').onclick = () => { qty = Math.max(1, qty - 1); $('#qty-val').textContent = qty; };
    $('#q-plus').onclick = () => { qty = Math.min(20, qty + 1); $('#qty-val').textContent = qty; };
    /* actions */
    $('#pd-cart')?.addEventListener('click', () => { cart.add(p, qty); toast(t('toast.cartAdd', { name: p.name }), 'success'); });
    $('#pd-buy')?.addEventListener('click', () => { cart.add(p, qty); location.hash = '#/checkout'; });
    /* tabs */
    $$('.tab-bar button').forEach(b => b.onclick = () => {
      $$('.tab-bar button').forEach(x => x.classList.remove('on')); b.classList.add('on');
      $$('.tab-panel').forEach(x => x.classList.add('hidden'));
      $('#tab-' + b.dataset.tab).classList.remove('hidden');
    });
    /* review form */
    const slot = $('#review-form-slot');
    if (!session.loggedIn) slot.innerHTML = `<p class="muted">${esc(t('pdp.reviewLogin'))} <a href="#/login?redirect=%23/product/${esc(p.id)}" style="color:#c4b5fd">${esc(t('nav.login'))}</a></p>`;
    else {
      let stars = 5;
      slot.innerHTML = `
        <div class="panel" style="padding:20px">
          <h3 style="font-size:.98rem">${esc(t('pdp.writeReview'))}</h3>
          <div class="stars-input" id="stars-input" style="margin:10px 0 14px">${[1,2,3,4,5].map(i => `<button data-s="${i}" class="on" aria-label="${i}">${icon('star')}</button>`).join('')}</div>
          <textarea class="textarea" id="review-text" maxlength="800" placeholder="${esc(t('pdp.writeReview'))}…" style="min-height:90px"></textarea>
          <button class="btn btn--primary btn--sm" id="review-send" style="margin-top:12px">${icon('send')}${esc(t('common.submit'))}</button>
        </div>`;
      $$('#stars-input button').forEach(b => b.onclick = () => {
        stars = +b.dataset.s;
        $$('#stars-input button').forEach(x => x.classList.toggle('on', +x.dataset.s <= stars));
      });
      $('#review-send').onclick = async () => {
        const text = $('#review-text').value.trim();
        if (text.length < 4) return toast(t('common.error'), 'error');
        await db.reviews.add(p.id, { rating: stars, text });
        toast(t('pdp.reviewSent'), 'success');
        $('#review-text').value = '';
      };
    }
    revealInit(app);
  },
};
