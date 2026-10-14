(function () {
  const form = document.getElementById('mainForm');
  if (!form) return;
  const requestType = document.getElementById('request-type');
  const subject = document.getElementById('subject');
  const status = document.getElementById('form-status');
  const button = form.querySelector('.submit-btn');
  const requestedMode = new URLSearchParams(window.location.search).get('typ');
  const initialType = requestedMode === 'obhliadka' ? 'Obhliadka' : 'Cenová ponuka';
  requestType.value = initialType;
  function updateSubject() { subject.value = 'Dopyt z webu Shpilka — ' + requestType.value; }
  updateSubject();
  requestType.addEventListener('change', updateSubject);

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (button.disabled || !form.reportValidity()) return;
    const inquiryType = requestType.value;
    updateSubject();
    status.hidden = true;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Odosielam…';
    try {
      const response = await fetch(form.action, {
        method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('Form submission failed');
      if (window.ShpilkaAnalytics) {
        window.ShpilkaAnalytics.event('generate_lead', {
          form_name: 'cenova_ponuka', request_type: inquiryType
        });
      }
      if (window.ShpilkaMeta) {
        window.ShpilkaMeta.event('Lead', { content_name: 'cenova_ponuka', request_type: inquiryType });
      }
      form.reset();
      requestType.value = initialType;
      updateSubject();
      status.classList.remove('error');
      status.textContent = 'Ďakujeme. Váš dopyt bol úspešne odoslaný. Ozveme sa vám a dohodneme ďalší postup.';
    } catch (_) {
      status.classList.add('error');
      status.textContent = 'Dopyt sa nepodarilo odoslať. Skúste to znova alebo nám zavolajte na +421 951 729 585.';
    } finally {
      button.disabled = false;
      button.textContent = originalText;
      status.hidden = false;
      status.focus();
    }
  });
})();
