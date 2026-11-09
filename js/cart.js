/* cart.js — shopping cart, wishlist and recently-viewed (localStorage, per-account where relevant) */
import { session } from './session.js';

const fire = (name) => window.dispatchEvent(new CustomEvent(name));
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const wishKey = () => 'etsy.wish.' + (session.uid || 'guest');

export const cart = {
  items: () => read('etsy.cart', []),
  count: () => cart.items().reduce((s, i) => s + i.qty, 0),
  subtotal: () => cart.items().reduce((s, i) => s + i.price * i.qty, 0),
  add(product, qty = 1) {
    const items = cart.items();
    const line = items.find(i => i.id === product.id);
    if (line) line.qty = Math.min(20, line.qty + qty);
    else items.push({ id: product.id, name: product.name, price: Number(product.price) || 0, qty, image: (product.images || [])[0] || null, cat: product.cat || '', stock: product.stock !== false });
    write('etsy.cart', items); fire('etsy:cart');
  },
  setQty(id, qty) {
    let items = cart.items();
    if (qty <= 0) items = items.filter(i => i.id !== id);
    else { const l = items.find(i => i.id === id); if (l) l.qty = Math.min(20, qty); }
    write('etsy.cart', items); fire('etsy:cart');
  },
  remove(id) { write('etsy.cart', cart.items().filter(i => i.id !== id)); fire('etsy:cart'); },
  clear() { write('etsy.cart', []); fire('etsy:cart'); },
  checkoutPayload() { return cart.items().map(i => ({ id: i.id, qty: i.qty })); },
};

export const wish = {
  ids: () => read(wishKey(), []),
  has: (id) => wish.ids().includes(id),
  toggle(id) {
    let ids = wish.ids();
    const added = !ids.includes(id);
    ids = added ? [...ids, id] : ids.filter(x => x !== id);
    write(wishKey(), ids); fire('etsy:wish');
    return added;
  },
};

export const recent = {
  list: () => read('etsy.recent', []).sort((a, b) => b.at - a.at).slice(0, 8),
  push(id) {
    let arr = read('etsy.recent', []).filter(x => x.id !== id);
    arr.push({ id, at: Date.now() });
    write('etsy.recent', arr.slice(-20));
  },
};
