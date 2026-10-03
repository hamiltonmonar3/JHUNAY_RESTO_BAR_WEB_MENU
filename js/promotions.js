(() => {
  const modal = document.getElementById('promotions-modal');
  const form = document.getElementById('promotions-form');
  const phoneInput = document.getElementById('promotions-phone');
  const consentInput = document.getElementById('promotions-consent');
  const honeypot = document.getElementById('promotions-website');
  const submitButton = document.getElementById('promotions-submit');
  const status = document.getElementById('promotions-status');
  const openButton = document.getElementById('promotions-open');
  const availabilityStatus = document.getElementById('promotions-button-status');
  const registrationEnabled = Boolean(window.JHUNAY_PROMOTIONS_CONFIG?.subscribeUrl);
  let previousFocus = null;

  openButton.disabled = !registrationEnabled;
  openButton.title = registrationEnabled ? 'Recibir notificaciones por WhatsApp' : 'Próximamente disponible';
  availabilityStatus.classList.toggle('hidden', registrationEnabled);

  function setStatus(message, type = 'info') {
    const colors = {
      info: 'text-gray-300',
      error: 'text-red-300',
      success: 'text-emerald-300'
    };
    status.className = `min-h-5 text-sm ${colors[type] || colors.info}`;
    status.textContent = message;
  }

  function normalizeEcuadorianPhone(value) {
    let digits = value.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = `593${digits.slice(1)}`;
    else if (digits.length === 9) digits = `593${digits}`;
    return /^5939\d{8}$/.test(digits) ? `+${digits}` : null;
  }

  window.togglePromotionsModal = () => {
    const isOpening = modal.classList.contains('hidden');
    if (isOpening) {
      previousFocus = document.activeElement;
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      phoneInput.focus();
    } else {
      window.closePromotionsModal();
    }
  };

  window.closePromotionsModal = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    previousFocus?.focus();
  };

  modal.addEventListener('click', event => {
    if (event.target === modal) window.closePromotionsModal();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) window.closePromotionsModal();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    setStatus('');

    if (honeypot.value) return;
    if (!consentInput.checked) {
      setStatus('Debes aceptar recibir promociones para registrarte.', 'error');
      consentInput.focus();
      return;
    }

    const phone = normalizeEcuadorianPhone(phoneInput.value);
    if (!phone) {
      setStatus('Escribe un celular ecuatoriano válido, por ejemplo 09XXXXXXXX.', 'error');
      phoneInput.focus();
      return;
    }

    const subscribeUrl = window.JHUNAY_PROMOTIONS_CONFIG?.subscribeUrl;
    if (!subscribeUrl) {
      setStatus('El registro automático aún no está conectado. Escríbenos por WhatsApp al 096 396 9957.', 'error');
      return;
    }

    submitButton.disabled = true;
    setStatus('Registrando tu consentimiento…');
    try {
      const response = await fetch(subscribeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, consent: true, website: honeypot.value })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'No pudimos completar el registro. Intenta de nuevo.');
      form.reset();
      setStatus('¡Listo! Te avisaremos de las próximas promociones por WhatsApp.', 'success');
    } catch (error) {
      setStatus(error.message || 'No pudimos completar el registro. Intenta de nuevo.', 'error');
    } finally {
      submitButton.disabled = false;
    }
  });
})();