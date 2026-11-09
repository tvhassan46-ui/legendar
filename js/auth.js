/* ============================================================================
 * auth.js — Firebase Authentication wrapper.
 * Production: register / login / email verification / password reset /
 * persistent sessions / admin custom-claim detection. Demo: local accounts.
 * ==========================================================================*/
import { fb, firebaseReady } from './firebase.js';
import { IS_DEMO } from './db.js';
import { session } from './session.js';
import { lang } from './i18n.js';

export const auth = { mode: () => (IS_DEMO ? 'demo' : 'firebase') };

/* ------------------------------------------------------------ demo backend */
function demoUsers() { try { return JSON.parse(localStorage.getItem('etsy.db.users') || '[]'); } catch { return []; } }
function persistUsers(u) { localStorage.setItem('etsy.db.users', JSON.stringify(u)); }

function demoSessionToState() {
  const uid = localStorage.getItem('etsy.demoUid');
  const u = demoUsers().find(x => x.uid === uid);
  session.set(u ? { uid: u.uid, email: u.email, displayName: u.displayName, emailVerified: !!u.emailVerified, role: u.role || 'customer', profile: u } : null);
}

function initDemoAuth() {
  Object.assign(auth, {
    async register({ name, email, password }) {
      const users = demoUsers();
      if (users.some(u => u.email === email.toLowerCase())) throw new Error('auth/email-already-in-use');
      const u = { uid: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), email: email.toLowerCase(), password, displayName: name, role: 'customer', emailVerified: false, createdAt: Date.now(), country: '', phone: '' };
      users.push(u); persistUsers(users);
      localStorage.setItem('etsy.demoUid', u.uid);
      demoSessionToState();
      return { needsVerification: true };
    },
    async login(email, password) {
      const u = demoUsers().find(x => x.email === email.toLowerCase() && x.password === password);
      if (!u) throw new Error('auth/invalid-credential');
      localStorage.setItem('etsy.demoUid', u.uid);
      demoSessionToState();
      return { needsVerification: !u.emailVerified };
    },
    async logout() { localStorage.removeItem('etsy.demoUid'); session.set(null); },
    async sendVerification() { /* demo mode: verification is simulated on the verify page */ },
    async simulateVerify() { // DEMO ONLY — clearly labelled in the UI
      const uid = localStorage.getItem('etsy.demoUid');
      const users = demoUsers(); const i = users.findIndex(u => u.uid === uid);
      if (i > -1) { users[i].emailVerified = true; persistUsers(users); demoSessionToState(); }
    },
    async resetPassword() { /* demo mode: link sending is simulated; nothing to do */ },
    async changePassword(currentPw, newPw) {
      const uid = localStorage.getItem('etsy.demoUid');
      const users = demoUsers(); const i = users.findIndex(u => u.uid === uid);
      if (i < 0 || users[i].password !== currentPw) throw new Error('auth/wrong-password');
      users[i].password = newPw; persistUsers(users);
    },
    async refresh() { demoSessionToState(); },
    async applyActionCode() { demoSessionToState(); },
    _demoSession: demoSessionToState,
  });
  demoSessionToState();
}

/* -------------------------------------------------------- firebase backend */
async function initFirebaseAuth() {
  const { authMod } = fb.mods;
  const A = fb.auth;
  const toState = async (user) => {
    if (!user) { session.set(null); return; }
    let role = 'customer', profile = null;
    try {
      const token = await user.getIdTokenResult();
      if (token.claims.admin === true) role = 'admin';
    } catch { /* claim read failure — stay customer */ }
    try {
      const { fsMod } = fb.mods;
      const snap = await fsMod.getDoc(fsMod.doc(fb.fsdb, 'users', user.uid));
      if (snap.exists()) { profile = snap.data(); if (profile.role === 'admin') role = 'admin'; }
    } catch { /* profile read failure — role from claim only */ }
    session.set({ uid: user.uid, email: user.email, displayName: user.displayName || profile?.displayName || null, emailVerified: user.emailVerified, role, profile });
  };

  Object.assign(auth, {
    async register({ name, email, password }) {
      const cred = await authMod.createUserWithEmailAndPassword(A, email, password);
      await authMod.updateProfile(cred.user, { displayName: name });
      try { await authMod.sendEmailVerification(cred.user); } catch { /* provider may disable */ }
      try {
        const { fsMod } = fb.mods;
        await fsMod.setDoc(fsMod.doc(fb.fsdb, 'users', cred.user.uid), {
          email: email.toLowerCase(), displayName: name, role: 'customer', createdAt: fsMod.serverTimestamp(), country: '', phone: '',
        });
      } catch { /* rules/offline — Cloud Function also creates the profile */ }
      await toState(cred.user);
      return { needsVerification: !cred.user.emailVerified };
    },
    async login(email, password) {
      const cred = await authMod.signInWithEmailAndPassword(A, email, password);
      await toState(cred.user);
      return { needsVerification: !cred.user.emailVerified };
    },
    async logout() { await authMod.signOut(A); },
    async sendVerification() {
      if (!A.currentUser) throw new Error('No session');
      await authMod.sendEmailVerification(A.currentUser);
    },
    async simulateVerify() { throw new Error('Real mode'); },
    async resetPassword(email) { await authMod.sendPasswordResetEmail(A, email); },
    async changePassword(currentPw, newPw) {
      const u = A.currentUser; if (!u) throw new Error('No session');
      const cred = authMod.EmailAuthProvider.credential(u.email, currentPw);
      await authMod.reauthenticateWithCredential(u, cred);
      await authMod.updatePassword(u, newPw);
    },
    async refresh() { if (A.currentUser) { await A.currentUser.reload(); await toState(A.currentUser); } },
    async applyActionCode(code) { await authMod.applyActionCode(A, code); if (A.currentUser) await A.currentUser.reload(); await toState(A.currentUser); },
  });

  await new Promise(resolve => {
    const unsub = A.onAuthStateChanged(async user => { await toState(user); resolve(); unsub(); });
    setTimeout(resolve, 4000); // safety: never block the app on a hung auth state
  });
}

export async function initAuth() {
  if (IS_DEMO || !firebaseReady()) initDemoAuth();
  else await initFirebaseAuth();
}

/** Friendly error messages keyed by Firebase auth error codes. */
export function authError(e) {
  const code = String(e?.code || e?.message || '');
  const map = {
    'auth/invalid-credential': ['Invalid credentials', 'Identifiants invalids', 'بيانات الدخول غير صحيحة'],
    'auth/wrong-password': ['Wrong password', 'Mot de passe incorrect', 'كلمة المرور خاطئة'],
    'auth/user-not-found': ['No account with this email', 'Aucun compte avec cet email', 'لا يوجد حساب بهذا البريد'],
    'auth/email-already-in-use': ['This email already has an account', 'Cet email a déjà un compte', 'هذا البريد مسجل مسبقاً'],
    'auth/weak-password': ['Password too weak (min 8 chars, letters + numbers)', 'Mot de passe trop faible (8 car. min, lettres + chiffres)', 'كلمة المرور ضعيفة (8 أحرف على الأقل مع أرقام)'],
    'auth/invalid-email': ['Invalid email address', 'Email invalide', 'بريد إلكتروني غير صالح'],
    'auth/too-many-requests': ['Too many attempts — try again later', 'Trop de tentatives — réessayez plus tard', 'محاولات كثيرة — أعد المحاولة لاحقاً'],
    'auth/requires-recent-login': ['Please sign in again to confirm', 'Veuillez vous reconnecter', 'يرجى تسجيل الدخول مجدداً'],
    'auth/network-request-failed': ['Network error — check your connection', 'Erreur réseau — vérifiez la connexion', 'خطأ في الشبكة — تحقق من اتصالك'],
  };
  for (const k of Object.keys(map)) if (code.includes(k)) { const i = { en: 0, fr: 1, ar: 2 }[lang()] ?? 0; return map[k][i]; }
  return e?.message || 'Authentication error';
}
