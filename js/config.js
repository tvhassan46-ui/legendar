/* ============================================================================
 * ETSY — Premium Software Marketplace
 * CONFIGURATION FILE — the ONLY place you need to edit to go live.
 * ----------------------------------------------------------------------------
 * 1. Paste your EXISTING Firebase project config below (from your original
 *    project's app.js / Firebase console > Project settings).
 *    Firebase web config keys are public identifiers, NOT secrets. Real
 *    security is enforced by Firestore/Storage Rules + Cloud Functions
 *    (see firestore.rules, storage.rules, functions/index.js).
 * 2. Fill the business placeholders (WhatsApp number, bank details) or manage
 *    them later from the Admin Dashboard (they are stored in the database).
 * 3. While firebaseConfig contains placeholder values, the site runs in a
 *    clearly-labelled "Demo data" mode so every flow stays testable.
 * ==========================================================================*/

export const FIREBASE_CONFIG = {
  apiKey:            "PASTE_YOUR_API_KEY",
  authDomain:        "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId:         "PASTE_YOUR_PROJECT_ID",
  storageBucket:     "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId:             "PASTE_YOUR_APP_ID"
};
export const FIREBASE_CONFIGURED = !FIREBASE_CONFIG.apiKey.startsWith('PASTE_');

/* Brand identity ---------------------------------------------------------- */
export const BRAND = {
  name: 'Legendar',
  tagline: 'Premium Software Marketplace',
  // Shown in the UI. Configure the real one from Admin → Settings → Support.
  whatsappNumber: '212610591514',            // ← provide your real number (digits only)
  supportEmail: 'support@example.com',       // ← provide your real support email
  currency: 'MAD',
  domain: ''                                 // ← your production domain, e.g. https://etsystore.ma (for SEO/OG tags)
};

export const isAdobeProduct = (product) => product?.cat === 'adobe' ||
  String(product?.category || '').startsWith('adobe-');

/* Business rules ----------------------------------------------------------- */
export const SHOP = {
  currency: 'MAD',
  freeShippingLabel: 'digital',              // delivery is digital by default
  receipt: { maxSizeMB: 5, types: ['image/jpeg','image/png','image/webp','application/pdf'] },
  countries: [
    ['MA','Morocco'],['AE','United Arab Emirates'],['SA','Saudi Arabia'],['EG','Egypt'],
    ['DZ','Algeria'],['TN','Tunisia'],['LY','Libya'],['MR','Mauritania'],
    ['FR','France'],['ES','Spain'],['BE','Belgium'],['DE','Germany'],['IT','Italy'],
    ['NL','Netherlands'],['PT','Portugal'],['GB','United Kingdom'],['US','United States'],
    ['CA','Canada'],['TR','Turkey'],['QA','Qatar'],['KW','Kuwait'],['JO','Jordan'],
    ['MA-OTHER','Other country']
  ],
  orderStatuses: ['awaiting_payment','under_review','paid','delivering','delivered','rejected','cancelled']
};
