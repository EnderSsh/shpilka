(function () {
  const CONSENT_KEY = 'shpilka_cookie_consent_v1';
  const GA_MEASUREMENT_ID = 'G-SYX0HGGWMW';

  function getConsent() {
    try { return JSON.parse(localStorage.getItem(CONSENT_KEY)); } catch (_) { return null; }
  }

  function setConsent(analytics) {
    const value = { necessary: true, analytics: !!analytics, updatedAt: new Date().toISOString() };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(value));
    if (value.analytics) loadAnalytics();
    hideBanner();
  }

  function loadAnalytics() {
    if (!GA_MEASUREMENT_ID || window.__shpilkaGaLoaded) return;
    window.__shpilkaGaLoaded = true;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_MEASUREMENT_ID);
    document.head.appendChild(script);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true, send_page_view: true });
    window.gtag('event', 'consent_analytics_granted');
  }



  function trackEvent(name, params) {
    const consent = getConsent();
    if (!consent || !consent.analytics) return;
    loadAnalytics();
    if (window.gtag) window.gtag('event', name, params || {});
  }

  function setupLeadTracking() {
    document.addEventListener('click', function (e) {
      const a = e.target.closest && e.target.closest('a');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (href.startsWith('tel:')) trackEvent('click_phone', { link_url: href, link_text: (a.textContent || '').trim() });
      else if (/wa\.me|whatsapp\.com/i.test(href)) trackEvent('click_whatsapp', { link_url: href });
      else if (href.startsWith('mailto:')) trackEvent('click_email', { link_url: href });
      else if (/^\/dopyt\/?(?:$|[?#])/.test(href)) trackEvent('begin_lead_form', { link_url: href });
    });
  }

  function hideBanner() {
    const el = document.getElementById('cookie-banner');
    if (el) el.remove();
  }

  function renderBanner(force) {
    if (document.getElementById('cookie-banner')) return;
    const current = getConsent();
    if (current && !force) {
      if (current.analytics) loadAnalytics();
      return;
    }

    const wrap = document.createElement('div');
    wrap.id = 'cookie-banner';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Nastavenia cookies');
    wrap.innerHTML = `
      <div class="cookie-box">
        <div class="cookie-copy">
          <strong>Používame súbory cookies</strong>
          <p>Nevyhnutné cookies sú potrebné na fungovanie webu. Analytické cookies použijeme iba s vaším súhlasom na meranie návštevnosti a zlepšovanie stránky.</p>
          <a href="/cookies/">Viac o cookies</a>
        </div>
        <div class="cookie-actions">
          <button type="button" class="cookie-btn secondary" data-cookie="reject">Odmietnuť</button>
          <button type="button" class="cookie-btn secondary" data-cookie="settings">Nastavenia</button>
          <button type="button" class="cookie-btn primary" data-cookie="accept">Prijať všetko</button>
        </div>
        <div class="cookie-settings" hidden>
          <label><span><b>Nevyhnutné</b><small>Vždy aktívne – zabezpečujú základné fungovanie stránky.</small></span><input type="checkbox" checked disabled></label>
          <label><span><b>Analytické</b><small>Google Analytics – iba po vašom súhlase.</small></span><input id="cookie-analytics" type="checkbox"></label>
          <button type="button" class="cookie-btn primary save" data-cookie="save">Uložiť nastavenia</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    const settings = wrap.querySelector('.cookie-settings');
    const analytics = wrap.querySelector('#cookie-analytics');
    if (current) analytics.checked = !!current.analytics;
    wrap.querySelector('[data-cookie="accept"]').onclick = () => setConsent(true);
    wrap.querySelector('[data-cookie="reject"]').onclick = () => setConsent(false);
    wrap.querySelector('[data-cookie="settings"]').onclick = () => { settings.hidden = !settings.hidden; };
    wrap.querySelector('[data-cookie="save"]').onclick = () => setConsent(analytics.checked);
  }

  window.ShpilkaCookies = { open: () => renderBanner(true), getConsent };
  window.ShpilkaAnalytics = { event: trackEvent };
  document.addEventListener('DOMContentLoaded', () => { renderBanner(false); setupLeadTracking(); });
})();
