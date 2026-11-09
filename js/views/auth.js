/* views/auth.js — login, register, email verification, forgot password */
import { icon } from '../icons.js';
import { t, lang } from '../i18n.js';
import { esc, $, V } from '../utils.js';
import { auth, authError } from '../auth.js';
import { session } from '../session.js';
import { toast } from '../ui.js';
import { IS_DEMO } from '../db.js';
import { SHOP } from '../config.js';

const layout = (inner, side = true) => `
<div class="auth-wrap">
  ${side ? `<div class="auth-side">
    <div class="orb orb--1" style="top:-140px"></div>
    <h2>${esc(t('auth.welcomeSide'))}</h2>
    <ul class="auth-points">
      <li>${icon('shieldCheck')}<span>${esc(t('auth.sp1'))}</span></li>
      <li>${icon('lock')}<span>${esc(t('auth.sp2'))}</span></li>
      <li>${icon('activity')}<span>${esc(t('auth.sp3'))}</span></li>
    </ul>
  </div>` : '<div class="auth-side"></div>'}
  <div class="auth-main"><div class="auth-card">${inner}</div></div>
</div>`;

const errBox = (id) => `<div class="alert alert--error hidden" id="${id}" role="alert"></div>`;
function showErr(id, msg) { const n = document.getElementById(id); if (n) { n.innerHTML = `${icon('alert')}<span>${esc(msg)}</span>`; n.classList.remove('hidden'); } }
function fieldErr(input, msg) {
  input.classList.add('invalid');
  let e = input.parentElement.querySelector('.field-error');
  if (!e) { e = document.createElement('span'); e.className = 'field-error'; input.parentElement.append(e); }
  e.innerHTML = `${icon('alert')} ${esc(msg)}`;
}
function clearErr(form) {
  form.querySelectorAll('.invalid').forEach(n => n.classList.remove('invalid'));
  form.querySelectorAll('.field-error').forEach(n => n.remove());
}

const redirect = (q) => { location.hash = q.redirect ? decodeURIComponent(q.redirect) : '#/'; };

/* ================================================================= LOGIN */
export const loginView = {
  titleKey: 'auth.loginTitle',
  render(app, params, q) {
    app.innerHTML = layout(`
      <h1>${esc(t('auth.loginTitle'))}</h1><p class="sub">${esc(t('auth.loginSub'))}</p>
      ${errBox('login-err')}
      <form id="login-form" novalidate>
        <div class="field"><label for="l-email">${esc(t('auth.email'))}</label>
          <input class="input" id="l-email" type="email" autocomplete="email" required /></div>
        <div class="field"><label for="l-pass">${esc(t('auth.password'))}</label>
          <input class="input" id="l-pass" type="password" autocomplete="current-password" required /></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <label class="checkline"><input type="checkbox" id="l-remember" checked />${esc(t('auth.remember'))}</label>
          <a href="#/forgot-password" style="color:#c4b5fd;font-size:.86rem">${esc(t('auth.forgot'))}</a>
        </div>
        <button class="btn btn--primary btn--block btn--lg" id="l-submit">${esc(t('auth.login'))}</button>
      </form>
      <p class="auth-alt">${esc(t('auth.noAccount'))} <a href="#/register">${esc(t('nav.register'))}</a></p>
      ${IS_DEMO ? `<div class="alert alert--info" style="margin-top:18px">${icon('info')}<span>${esc(t('auth.demoHint'))}</span></div>` : ''}`);

    document.getElementById('login-form').onsubmit = async e => {
      e.preventDefault(); clearErr(e.target);
      const email = $('#l-email').value.trim(), pass = $('#l-pass').value;
      let ok = true;
      if (!V.email(email)) { fieldErr($('#l-email'), 'Email'); ok = false; }
      if (pass.length < 6) { fieldErr($('#l-pass'), 'Password'); ok = false; }
      if (!ok) return;
      const btn = $('#l-submit'); btn.disabled = true; btn.innerHTML = '<span class="inline-spin"></span>';
      try {
        const r = await auth.login(email, pass);
        window.dispatchEvent(new CustomEvent('etsy:auth'));
        toast(t('toast.loginOk'), 'success');
        if (r.needsVerification) location.hash = '#/verify-email';
        else redirect(q);
      } catch (err) { showErr('login-err', authError(err)); btn.disabled = false; btn.textContent = t('auth.login'); }
    };
  },
};

/* ============================================================== REGISTER */
export const registerView = {
  titleKey: 'auth.registerTitle',
  render(app) {
    app.innerHTML = layout(`
      <h1>${esc(t('auth.registerTitle'))}</h1><p class="sub">${esc(t('auth.registerSub'))}</p>
      ${errBox('reg-err')}
      <form id="reg-form" novalidate>
        <div class="field"><label for="r-name">${esc(t('auth.fullName'))} <span class="req">*</span></label>
          <input class="input" id="r-name" autocomplete="name" required /></div>
        <div class="field"><label for="r-email">${esc(t('auth.email'))} <span class="req">*</span></label>
          <input class="input" id="r-email" type="email" autocomplete="email" required /></div>
        <div class="form-grid">
          <div class="field"><label for="r-country">${esc(t('auth.country'))}</label>
            <select class="select" id="r-country">${SHOP.countries.map(([c, n]) => `<option value="${c}"${c === 'MA' ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
          <div class="field"><label for="r-phone">${esc(t('auth.phone'))}</label>
            <input class="input" id="r-phone" type="tel" autocomplete="tel" placeholder="+212 6XX XXX XXX" /></div>
        </div>
        <div class="form-grid">
          <div class="field"><label for="r-pass">${esc(t('auth.password'))} <span class="req">*</span></label>
            <input class="input" id="r-pass" type="password" autocomplete="new-password" required />
            <span class="field-hint">${esc(t('auth.pwHint'))}</span></div>
          <div class="field"><label for="r-pass2">${esc(t('auth.confirmPassword'))} <span class="req">*</span></label>
            <input class="input" id="r-pass2" type="password" autocomplete="new-password" required /></div>
        </div>
        <label class="checkline" style="margin-bottom:20px"><input type="checkbox" id="r-terms" />
          <span>${esc(t('auth.terms'))} <a href="#/terms" target="_blank" style="color:#c4b5fd;text-decoration:underline">${esc(t('auth.termsLink'))}</a> ${esc(t('auth.and'))} <a href="#/privacy" target="_blank" style="color:#c4b5fd;text-decoration:underline">${esc(t('auth.privacyLink'))}</a>.</span></label>
        <button class="btn btn--primary btn--block btn--lg" id="r-submit">${esc(t('auth.register'))}</button>
      </form>
      <p class="auth-alt">${esc(t('auth.haveAccount'))} <a href="#/login">${esc(t('nav.login'))}</a></p>`);

    document.getElementById('reg-form').onsubmit = async e => {
      e.preventDefault(); clearErr(e.target);
      const name = $('#r-name').value.trim(), email = $('#r-email').value.trim();
      const pass = $('#r-pass').value, pass2 = $('#r-pass2').value, phone = $('#r-phone').value.trim();
      let ok = true;
      if (!V.name(name)) { fieldErr($('#r-name'), t('auth.fullName')); ok = false; }
      if (!V.email(email)) { fieldErr($('#r-email'), t('auth.email')); ok = false; }
      if (phone && !V.phone(phone)) { fieldErr($('#r-phone'), t('auth.phone')); ok = false; }
      if (!V.password(pass)) { fieldErr($('#r-pass'), t('auth.pwHint')); ok = false; }
      if (pass !== pass2) { fieldErr($('#r-pass2'), t('auth.confirmPassword')); ok = false; }
      if (!$('#r-terms').checked) { showErr('reg-err', t('auth.terms') + ' → ' + t('auth.termsLink')); ok = false; }
      if (!ok) return;
      const btn = $('#r-submit'); btn.disabled = true; btn.innerHTML = '<span class="inline-spin"></span>';
      try {
        await auth.register({ name, email, password: pass, country: $('#r-country').value, phone });
        window.dispatchEvent(new CustomEvent('etsy:auth'));
        toast(t('toast.registerOk'), 'success');
        location.hash = '#/verify-email';
      } catch (err) { showErr('reg-err', authError(err)); btn.disabled = false; btn.textContent = t('auth.register'); }
    };
  },
};

/* ========================================================== VERIFY EMAIL */
export const verifyView = {
  titleKey: 'auth.verifyTitle',
  async render(app, params, query) {
    /* Handle the Firebase email action link (real mode) */
    let linkHandled = false;
    if (!IS_DEMO && query.oobCode) {
      try { await auth.applyActionCode(query.oobCode); linkHandled = true; }
      catch (e) { console.warn('verify link', e); }
    }
    const done = linkHandled || session.loggedIn && session.emailVerified;
    app.innerHTML = layout(`
      <div class="verified-banner">
        <div class="big-icon" style="${done ? 'border-color:rgba(52,211,153,.5);background:rgba(52,211,153,.1)' : ''}">
          ${icon(done ? 'checkCircle' : 'mailCheck')}
        </div>
        <h1>${esc(t(done ? 'auth.verifyDone' : 'auth.verifyTitle'))}</h1>
        ${!done ? `<p class="muted">${esc(t('auth.verifyPending'))}</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
          <button class="btn btn--primary" id="v-resend">${icon('send')}${esc(t('auth.verifyBtn'))}</button>
          <button class="btn btn--ghost" id="v-refresh">${icon('refresh')}${esc(t('auth.refresh'))}</button>
          ${IS_DEMO ? `<button class="btn btn--success" id="v-simulate">${icon('check')}${esc('Simulate verification link (demo)')}</button>` : ''}
        </div>` : `<a class="btn btn--primary" href="#/catalog">${esc(t('auth.verifyCta'))}</a>`}
      </div>`);
    if (done) return;
    $('#v-resend').onclick = async () => {
      try { await auth.sendVerification(); toast(t('auth.verifySent'), 'success'); }
      catch { toast(t('common.error'), 'error'); }
    };
    $('#v-refresh').onclick = async () => {
      await auth.refresh();
      window.dispatchEvent(new CustomEvent('etsy:auth'));
      if (session.emailVerified) verifyView.render(app, params, query);
      else toast(t('auth.verifyPending'), 'info');
    };
    $('#v-simulate')?.addEventListener('click', async () => {   // DEMO MODE ONLY
      await auth.simulateVerify();
      window.dispatchEvent(new CustomEvent('etsy:auth'));
      verifyView.render(app, params, query);
    });
  },
};

/* ======================================================== FORGOT PASSWORD */
export const forgotView = {
  titleKey: 'auth.forgotTitle',
  render(app) {
    app.innerHTML = layout(`
      <h1>${esc(t('auth.forgotTitle'))}</h1><p class="sub">${esc(t('auth.forgotSub'))}</p>
      ${errBox('fp-err')}
      <form id="fp-form" novalidate>
        <div class="field"><label for="f-email">${esc(t('auth.email'))}</label>
          <input class="input" id="f-email" type="email" autocomplete="email" required /></div>
        <button class="btn btn--primary btn--block btn--lg" id="f-submit">${esc(t('auth.sendReset'))}</button>
      </form>
      <p class="auth-alt"><a href="#/login">${esc(t('nav.login'))}</a></p>`);
    document.getElementById('fp-form').onsubmit = async e => {
      e.preventDefault(); clearErr(e.target);
      const email = $('#f-email').value.trim();
      if (!V.email(email)) return fieldErr($('#f-email'), t('auth.email'));
      const btn = $('#f-submit'); btn.disabled = true;
      try {
        await auth.resetPassword(email);
        showOk('#fp-form', t('auth.resetSent') + (IS_DEMO ? ' (demo: simulated)' : ''));
      } catch (err) { showErr('fp-err', authError(err)); }
      btn.disabled = false;
    };
    function showOk(sel, msg) {
      const n = document.querySelector(sel);
      const ok = document.createElement('div'); ok.className = 'alert alert--success';
      ok.innerHTML = `${icon('checkCircle')}<span>${esc(msg)}</span>`;
      n.prepend(ok);
    }
  },
};
