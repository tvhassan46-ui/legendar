/* Shared session snapshot — avoids circular imports between auth and data layers. */

export const session = {
  uid: null,
  email: null,
  displayName: null,
  emailVerified: false,
  role: 'customer',          // 'customer' | 'admin'
  profile: null,             // Firestore users/{uid} doc (or local profile in demo)
  listeners: new Set(),
  set(user) {
    Object.assign(this, {
      uid: user?.uid ?? null, email: user?.email ?? null,
      displayName: user?.displayName ?? null,
      emailVerified: user?.emailVerified ?? false,
      role: user?.role ?? 'customer', profile: user?.profile ?? null,
    });
    for (const fn of this.listeners) { try { fn(this.snapshot()); } catch (e) { console.error(e); } }
  },
  snapshot() { return { uid: this.uid, email: this.email, displayName: this.displayName, emailVerified: this.emailVerified, role: this.role, profile: this.profile }; },
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  get isAdmin() { return this.role === 'admin'; },
  get loggedIn() { return !!this.uid; },
};
