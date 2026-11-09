# Legendar — Premium Software Marketplace

Cinematic 3D storefront (Three.js) for Adobe & engineering software, with manual
payment verification (CIH / RIB bank transfer) and digital delivery.

## Stack
- Vanilla JS SPA — `index.html` + `app.js` + hash routing (no build step)
- Three.js r160 (vendored in `assets/vendor/`) powers the cinematic homepage hero
- Dual data layer: Firestore (production) or seeded localStorage (demo mode)
- Firebase Auth + OTP email verification
- i18n: English / Français / العربية

## Run locally
```bash
node server.js   # http://localhost:8080
```

## Deploy
Static site — no build command. Any static host (Vercel, Netlify, GitHub Pages) works.

## Go live with your own data
1. Paste your Firebase web config into `js/config.js` (`FIREBASE_CONFIG`).
2. Set the WhatsApp number / support email in `js/config.js` or from Admin → Settings.
3. Deploy Firestore rules + Cloud Functions (see project docs).

While the Firebase config contains placeholders, the site runs in a clearly-labelled
**DEMO mode**.

### Demo accounts (demo mode only)
| Role     | Email              | Password    |
|----------|--------------------|-------------|
| Admin    | admin@etsy.demo    | Admin123!   |
| Customer | client@etsy.demo   | Client123!  |

Demo product records are placeholders — replace them from the admin dashboard.
