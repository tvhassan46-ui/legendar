/* views/pages.js — contact, FAQ, about, privacy, terms, 404 */
import { icon } from '../icons.js';
import { t, lang } from '../i18n.js';
import { esc, $, V } from '../utils.js';
import { db } from '../db.js';
import { toast, emptyState, revealInit } from '../ui.js';
import { BRAND } from '../config.js';

/* =============================================================== CONTACT */
export const contactView = {
  titleKey: 'contact.title',
  render(app) {
    app.innerHTML = `
    <div class="container">
      <div class="page-head"><h1>${esc(t('contact.title'))}</h1><p class="lead">${esc(t('contact.lead'))}</p></div>
      <div class="contact-layout">
        <div class="panel">
          <h3>${icon('send')}${esc(t('contact.form'))}</h3>
          <div id="c-alert"></div>
          <form id="contact-form" novalidate>
            <div class="form-grid">
              <div class="field"><label>${esc(t('contact.name'))} *</label><input class="input" id="ct-name" required /></div>
              <div class="field"><label>${esc(t('contact.email'))} *</label><input class="input" id="ct-email" type="email" required /></div>
            </div>
            <div class="field"><label>${esc(t('contact.subject'))} *</label><input class="input" id="ct-subject" required /></div>
            <div class="field"><label>${esc(t('contact.message'))} *</label><textarea class="textarea" id="ct-msg" maxlength="3000" required></textarea></div>
            <button class="btn btn--primary" id="ct-send">${icon('send')}${esc(t('common.submit'))}</button>
          </form>
        </div>
        <div>
          <a class="panel" href="https://wa.me/${esc(BRAND.whatsappNumber)}" target="_blank" rel="noopener" style="display:block">
            <h3 style="color:#86efac">${icon('whatsapp')}${esc(t('contact.whatsapp'))}</h3>
            <p class="muted" style="font-size:.9rem">${esc(t('contact.whatsappAvail'))}</p>
            <span class="mono" style="font-size:.9rem">+${esc(BRAND.whatsappNumber)}</span>
          </a>
          <a class="panel" href="mailto:${esc(BRAND.supportEmail)}" style="display:block;margin-top:18px">
            <h3>${icon('mail')}${esc(t('contact.emailUs'))}</h3>
            <span class="mono" style="font-size:.9rem">${esc(BRAND.supportEmail)}</span>
          </a>
          <div class="alert alert--info" style="margin-top:18px">${icon('shieldCheck')}<span>${esc(t('pay.security'))}</span></div>
        </div>
      </div>
    </div>`;
    $('#contact-form').onsubmit = async e => {
      e.preventDefault();
      const name = $('#ct-name').value.trim(), email = $('#ct-email').value.trim();
      const subject = $('#ct-subject').value.trim(), msg = $('#ct-msg').value.trim();
      const alert = $('#c-alert');
      if (!V.name(name) || !V.email(email) || subject.length < 3 || !V.safeText(msg) || msg.length < 10) {
        alert.innerHTML = `<div class="alert alert--error">${icon('alert')}<span>${esc(t('common.error'))} — ${esc(t('common.required'))}</span></div>`;
        return;
      }
      const btn = $('#ct-send'); btn.disabled = true;
      try {
        await db.messages.create({ name, email, subject, message: msg });
        toast(t('contact.sent'), 'success');
        e.target.reset();
      } catch { toast(t('common.error'), 'error'); }
      btn.disabled = false;
    };
  },
};

/* =================================================================== FAQ */
export const faqView = {
  titleKey: 'faq.title',
  async render(app) {
    const faqs = await db.faq.list();
    app.innerHTML = `
    <div class="container">
      <div class="page-head"><h1>${esc(t('faq.title'))}</h1><p class="lead">${esc(t('faq.lead'))}</p></div>
      <div style="max-width:760px">
        ${faqs.map(f => `<details class="faq-acc"><summary>${esc(f.q)}</summary><div class="faq-body">${esc(f.a)}</div></details>`).join('') || ''}
      </div>
      ${!faqs.length ? '' : ''}
      <div class="empty-state" style="margin-top:40px;display:none"></div>
      <div class="cta-band reveal" style="margin:50px 0">
        <h2>${esc(t('contact.lead'))}</h2>
        <a class="btn btn--primary" href="#/contact">${icon('message')}${esc(t('contact.form'))}</a>
      </div>
    </div>`;
    if (!faqs.length) {
      app.querySelector('.container').prepend(emptyState({ ic: 'question', title: t('common.noResults'), text: t('faq.lead') }));
    }
    revealInit(app);
  },
};

/* ================================================================= ABOUT */
export const aboutView = {
  titleKey: 'about.title',
  render(app) {
    const M = {
      en: {
        p1: 'Legendar is a premium software marketplace focused on two worlds we know deeply: the Adobe creative ecosystem and professional software engineering tools.',
        p2: 'Every order on Legendar follows a strict verification flow: you order, pay by Moroccan bank transfer, upload your receipt, and our team manually verifies each payment before delivery. Nothing is automatic, nothing is hidden.',
        p3: 'We believe professionals deserve a store that is precise, secure and honest — with real support over WhatsApp and a dashboard where you can follow every step of your order.',
        h: 'Our commitments', b1: 'Only officially licensed offerings — we never advertise cracked or unauthorized software.',
        b2: 'Manual verification of every payment before any delivery.', b3: 'Private orders — your data belongs to you.', b4: 'Human support before and after every purchase.',
      },
      fr: {
        p1: 'Legendar est une marketplace logicielle premium centrée sur deux univers que nous maîtrisons : l’écosystème créatif Adobe et les outils de génie logiciel professionnels.',
        p2: 'Chaque commande suit un flux strict : commande, virement bancaire marocain, envoi du reçu, puis vérification manuelle par notre équipe avant livraison. Rien d’automatique, rien de caché.',
        p3: 'Nous croyons que les professionnels méritent une boutique précise, sécurisée et honnête — avec un vrai support WhatsApp et un tableau de bord pour suivre chaque étape.',
        h: 'Nos engagements', b1: 'Uniquement des offres sous licence officielle — jamais de logiciels piratés.',
        b2: 'Vérification manuelle de chaque paiement avant livraison.', b3: 'Commandes privées — vos données vous appartiennent.', b4: 'Support humain avant et après chaque achat.',
      },
      ar: {
        p1: 'Legendar متجر برمجيات متميز يركز على عالمين نعرفهما جيداً: منظومة أدوبي الإبداعية وأدوات هندسة البرمجيات الاحترافية.',
        p2: 'كل طلب في Legendar يتبع مساراً صارماً: الطلب، التحويل البنكي المغربي، رفع الوصل، ثم تحقق يدوي من طرف فريقنا قبل التسليم. لا شيء تلقائي ولا شيء خفي.',
        p3: 'نؤمن أن المحترفين يستحقون متجراً دقيقاً وآمناً وصادقاً — بدعم حقيقي عبر واتساب ولوحة لمتابعة كل خطوة من الطلب.',
        h: 'التزاماتنا', b1: 'عروض مرخصة رسمياً فقط — لا نعلن أبداً عن برمجيات مقرصنة أو غير مصرح بها.',
        b2: 'تحقق يدوي من كل دفعة قبل أي تسليم.', b3: 'طلبات خاصة — بياناتك ملك لك.', b4: 'دعم بشري قبل وبعد كل عملية شراء.',
      },
    }[lang()] || {};
    app.innerHTML = `
    <div class="container">
      <div class="page-head"><h1>${esc(t('about.title'))}</h1></div>
      <div class="prose">
        <p>${esc(M.p1)}</p><p>${esc(M.p2)}</p><p>${esc(M.p3)}</p>
        <h2>${esc(M.h)}</h2>
        <ul><li>${esc(M.b1)}</li><li>${esc(M.b2)}</li><li>${esc(M.b3)}</li><li>${esc(M.b4)}</li></ul>
      </div>
    </div>`;
  },
};

/* ================================================================ LEGAL */
const LEGAL = {
  privacy: {
    en: [
      ['Data we collect', 'We collect the account information you provide (name, email, phone, country), your orders, receipts you upload, and technical data needed to operate the store.'],
      ['How we use it', 'To process your orders, verify payments manually, deliver purchases, provide support, and meet legal obligations. We never sell your data.'],
      ['Storage & security', 'Data is stored in Google Firebase with encrypted transport, strict security rules and per-user access control. Only you and verified administrators can access your private orders.'],
      ['Your rights', 'You may request access, correction or deletion of your personal data at any time by contacting support. Deleting your account removes access to order history.'],
      ['Cookies & local storage', 'We use local storage for your session, cart, wishlist and language preference. No third-party advertising trackers.'],
    ],
    fr: [
      ['Données collectées', 'Nous collectons les informations de compte fournies (nom, email, téléphone, pays), vos commandes, les reçus envoyés et les données techniques nécessaires au fonctionnement.'],
      ['Utilisation', 'Traiter vos commandes, vérifier manuellement les paiements, livrer les achats, assurer le support et respecter les obligations légales. Nous ne vendons jamais vos données.'],
      ['Stockage & sécurité', 'Les données sont hébergées sur Google Firebase avec transport chiffré, règles de sécurité strictes et contrôle d’accès par utilisateur. Seuls vous et des administrateurs vérifiés accèdent à vos commandes.'],
      ['Vos droits', 'Vous pouvez demander l’accès, la rectification ou la suppression de vos données à tout moment via le support.'],
      ['Cookies & stockage local', 'Stockage local pour la session, le panier, les favoris et la langue. Aucun traceur publicitaire tiers.'],
    ],
    ar: [
      ['البيانات التي نجمعها', 'نجمع بيانات الحساب التي تقدمها (الاسم، البريد، الهاتف، البلد)، وطلباتك، والوصولات التي ترفعها، والبيانات التقنية اللازمة لتشغيل المتجر.'],
      ['كيف نستخدمها', 'لمعالجة طلباتك، والتحقق يدوياً من المدفوعات، وتسليم المشتريات، وتقديم الدعم، والامتثال للالتزامات القانونية. لا نبيع بياناتك أبداً.'],
      ['التخزين والأمان', 'تُخزن البيانات في Google Firebase مع نقل مشفر وقواعد أمان صارمة وتحكم بالوصول لكل مستخدم. أنت والمديرون الموثقون فقط يمكنهم الوصول إلى طلباتك الخاصة.'],
      ['حقوقك', 'يمكنك طلب الوصول إلى بياناتك أو تصحيحها أو حذفها في أي وقت عبر الدعم.'],
      ['الكوكيز والتخزين المحلي', 'نستخدم التخزين المحلي للجلسة والسلة والمفضلة واللغة. لا نتتبعات إعلانية طرف ثالث.'],
    ],
  },
  terms: {
    en: [
      ['Accounts', 'You must provide accurate information and keep your credentials confidential. Accounts are personal and email verification is required before ordering.'],
      ['Orders & payment', 'Orders are confirmed only after manual verification of your bank transfer by our team. Uploading a receipt does not mark an order as paid. We never ask for bank passwords, card PINs or OTP codes.'],
      ['Licenses', 'Products are offered under their official license terms, stated on each product page. The store commits to listing only authorized offerings. Demo-labelled records are demonstration data and are not sellable.'],
      ['Delivery', 'Delivery is digital and occurs after payment verification, within the timeframe stated on the product page or agreed with support.'],
      ['Returns', 'Given the digital nature of licenses, delivered and activated licenses cannot be refunded. If delivery fails or the license is invalid, you receive a full refund or replacement.'],
      ['Acceptable use', 'Any attempt to abuse, attack or defraud the platform results in immediate account termination and legal action where applicable.'],
    ],
    fr: [
      ['Comptes', 'Vous devez fournir des informations exactes et garder vos identifiants confidentiels. Vérification d’email obligatoire avant toute commande.'],
      ['Commandes & paiement', 'Les commandes sont confirmées uniquement après vérification manuelle de votre virement. L’envoi d’un reçu ne vaut pas paiement. Nous ne demandons jamais mots de passe bancaires, PIN ou OTP.'],
      ['Licences', 'Les produits sont proposés sous leurs termes de licence officiels, indiqués sur chaque page produit. Seules des offres autorisées sont listées. Les enregistrements DEMO ne sont pas vendables.'],
      ['Livraison', 'Livraison numérique après vérification du paiement, dans le délai indiqué sur la page produit ou convenu avec le support.'],
      ['Retours', 'Compte tenu de la nature numérique des licences, aucune remboursement après livraison et activation. En cas d’échec de livraison ou de licence invalide : remboursement complet ou remplacement.'],
      ['Usage acceptable', 'Toute tentative d’abus, d’attaque ou de fraude entraîne la fermeture immédiate du compte et, le cas échéant, des poursuites.'],
    ],
    ar: [
      ['الحسابات', 'يجب تقديم معلومات دقيقة والحفاظ على سرية بيانات الدخول. تفعيل البريد مطلوب قبل الطلب.'],
      ['الطلبات والدفع', 'تُأكد الطلبات فقط بعد تحقق يدوي من تحويلك البنكي. رفع الوصل لا يعني الدفع. لا نطلب أبداً كلمات سر بنكية أو أرقام PIN أو رموز OTP.'],
      ['التراخيص', 'تُقدم المنتجات وفق شروط ترخيصها الرسمية المذكورة في صفحة كل منتج. يلتزم المتجر بعرض عروض مصرح بها فقط. سجلات DEMO بيانات تجريبية غير قابلة للبيع.'],
      ['التسليم', 'التسليم رقمي ويتم بعد التحقق من الدفع، ضمن المدة المذكورة في صفحة المنتج أو المتفق عليها مع الدعم.'],
      ['الاسترجاع', 'نظراً للطبيعة الرقمية للتراخيص، لا يمكن استرجاع المبالغ بعد التسليم والتفعيل. في حال فشل التسليم أو عدم صلاحية الترخيص: استرجاع كامل أو استبدال.'],
      ['الاستخدام المقبول', 'أي محاولة لإساءة الاستخدام أو مهاجمة المنصة أو الاحتيال عليها تؤدي إلى إغلاق الحساب فوراً واتخاذ الإجراءات القانونية عند الاقتضاء.'],
    ],
  },
};

function legalPage(key) {
  return {
    render(app) {
      const secs = LEGAL[key][lang()] || LEGAL[key].en;
      app.innerHTML = `
      <div class="container">
        <div class="page-head"><h1>${esc(t(key + '.title'))}</h1>
        <p class="lead">Legendar — ${new Date().getFullYear()}</p></div>
        <div class="prose">${secs.map(([h, p]) => `<h2>${esc(h)}</h2><p>${esc(p)}</p>`).join('')}</div>
      </div>`;
    },
  };
}
export const privacyView = { titleKey: 'privacy.title', ...legalPage('privacy') };
export const termsView = { titleKey: 'terms.title', ...legalPage('terms') };

/* =================================================================== 404 */
export const notFoundView = {
  render(app) {
    document.title = 'Legendar — 404';
    app.innerHTML = `<div class="container section"></div>`;
    const box = document.createElement('div');
    box.className = 'empty-state';
    box.style.maxWidth = '560px';
    box.style.margin = '60px auto';
    box.innerHTML = `<div class="es-icon" style="border-radius:50%"><span style="font-family:var(--font-display);font-size:1.6rem;font-weight:700" class="grad-text">404</span></div>
      <h3>${esc(t('404.title'))}</h3><p>${esc(t('404.lead'))}</p>`;
    const a = document.createElement('a');
    a.className = 'btn btn--primary'; a.href = '#/'; a.textContent = t('404.btn');
    box.append(a);
    app.firstElementChild.append(box);
  },
};
