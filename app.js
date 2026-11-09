/* ============================================================================
 * ETSY — Premium Software Marketplace · app.js (entry point)
 * Architecture preserved: index.html + styles.css + app.js with hash routing.
 * ==========================================================================*/
import { initDb, IS_DEMO } from './js/db.js';
import { initAuth } from './js/auth.js';
import { route, setNotFound, startRouter } from './js/router.js';
import { renderHeader, renderFooter, mountExtras, bindGlobalActions, pollNotifs, toast } from './js/ui.js';
import { t } from './js/i18n.js';

/* views */
import { homeView, catalogView, categoryView, productView, searchView } from './js/views/shop.js';
import { loginView, registerView, verifyView, forgotView } from './js/views/auth.js';
import { cartView, checkoutView, successView, payView, receiptView } from './js/views/checkout.js';
import { profileView, wishlistView, ordersView, orderView, trackView, notifsView } from './js/views/account.js';
import { contactView, faqView, aboutView, privacyView, termsView, notFoundView } from './js/views/pages.js';
import {
  adminHome, adminOrders, adminProducts, adminProductEdit, adminCategories,
  adminCustomers, adminPayments, adminBanners, adminCoupons, adminFaq, adminMessages, adminLogs,
} from './js/views/admin.js';

/* ------------------------------------------------------------ route table */
route('/', homeView);
route('/catalog', catalogView);
route('/category/:id', categoryView);
route('/product/:id', productView);
route('/search', searchView);
route('/login', loginView);
route('/register', registerView);
route('/verify-email', verifyView);
route('/forgot-password', forgotView);
route('/cart', cartView);
route('/checkout', checkoutView, { auth: true });
route('/success/:id', successView);
route('/pay/:id', payView, { auth: true });
route('/receipt/:id', receiptView, { auth: true });
route('/profile', profileView, { auth: true });
route('/wishlist', wishlistView, { auth: true });
route('/orders', ordersView, { auth: true });
route('/order/:id', orderView, { auth: true });
route('/track', trackView, { auth: true });
route('/notifications', notifsView, { auth: true });
route('/contact', contactView);
route('/faq', faqView);
route('/about', aboutView);
route('/privacy', privacyView);
route('/terms', termsView);
route('/admin', adminHome, { admin: true });
route('/admin/orders', adminOrders, { admin: true });
route('/admin/orders/:id', adminOrders, { admin: true });
route('/admin/products', adminProducts, { admin: true });
route('/admin/products/new', adminProductEdit, { admin: true });
route('/admin/products/:id', adminProductEdit, { admin: true });
route('/admin/categories', adminCategories, { admin: true });
route('/admin/customers', adminCustomers, { admin: true });
route('/admin/payments', adminPayments, { admin: true });
route('/admin/banners', adminBanners, { admin: true });
route('/admin/coupons', adminCoupons, { admin: true });
route('/admin/faq', adminFaq, { admin: true });
route('/admin/messages', adminMessages, { admin: true });
route('/admin/logs', adminLogs, { admin: true });
setNotFound(notFoundView);

/* ------------------------------------------------------------------ boot */
(async function boot() {
  try {
    await initDb();      // Firestore or demo backend
    await initAuth();    // persistent session (Firebase Auth or demo)
  } catch (err) {
    console.error('[ETSY] init error:', err);
    document.getElementById('app').innerHTML =
      `<div class="container section"><div class="alert alert--error">Initialization error: ${String(err.message || err)}</div></div>`;
  }
  renderHeader();
  renderFooter();
  mountExtras();
  bindGlobalActions();
  pollNotifs();
  startRouter();

  /* re-render chrome when language changes */
  window.addEventListener('etsy:lang', () => {
    renderHeader(); renderFooter(); mountExtras();
    window.dispatchEvent(new CustomEvent('hashchange-soft'));
    startRouter.render?.();
    window.dispatchEvent(new Event('hashchange'));
  });

  /* global error safety net — no silent failures */
  window.addEventListener('unhandledrejection', e => {
    console.error('[ETSY] unhandled rejection:', e.reason);
    toast(t('common.error'), 'error');
    e.preventDefault?.();
  });
})();
