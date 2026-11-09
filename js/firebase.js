/* Firebase bootstrap — loads the modular SDK from CDN only when configured.
   In demo mode nothing is imported and the app runs fully locally. */
import { FIREBASE_CONFIG, FIREBASE_CONFIGURED } from './config.js';

const V = '10.12.5';
const state = { ready: false, app: null, auth: null, fsdb: null, storage: null, fns: null, mods: null };

export const firebaseReady = () => state.ready;

export async function initFirebase() {
  if (!FIREBASE_CONFIGURED || state.ready) return state.ready;
  try {
    const [appMod, authMod, fsMod, stMod, fnMod] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-storage.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-functions.js`),
    ]);
    state.app = appMod.initializeApp(FIREBASE_CONFIG);
    state.auth = authMod.getAuth(state.app);
    await authMod.setPersistence(state.auth, authMod.browserLocalPersistence); // persistent sessions
    state.fsdb = fsMod.getFirestore(state.app);
    state.storage = stMod.getStorage(state.app);
    state.fns = fnMod.getFunctions(state.app);
    state.mods = { appMod, authMod, fsMod, stMod, fnMod };
    state.ready = true;
  } catch (err) {
    console.error('[ETSY] Firebase init failed — falling back to demo mode.', err);
  }
  return state.ready;
}

export const fb = state;
export const CALLABLES = ['createOrder', 'validateCoupon', 'reviewPayment', 'updateOrderStatus', 'cancelOrder', 'setAdminRole', 'bootstrapAdmin'];
