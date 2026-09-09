(() => {
  const cfg = window.BTYA_SUPABASE_CONFIG || {};
  const ready = Boolean(window.supabase && cfg.url && cfg.publishableKey && !cfg.publishableKey.includes('PASTE_'));
  const client = ready ? window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) : null;
  window.BTYASupabase = client;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  let method = 'email';
  let pendingIdentifier = '';
  let pendingMode = 'login';
  let currentUser = null;

  function toast(message) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(window.__btyaToastTimer);
    window.__btyaToastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  function friendlyError(error) {
    if (!error) return 'Something went wrong. Please try again.';
    const msg = String(error.message || error.error_description || error);
    if (/rate limit/i.test(msg)) return 'Too many attempts. Wait a little and try again.';
    if (/invalid.*otp|otp.*invalid|token.*invalid|expired/i.test(msg)) return 'That code is invalid or expired.';
    if (/phone.*provider|sms|twilio|vonage|messagebird/i.test(msg)) return 'Phone OTP is not configured on this Supabase project yet. Use Email OTP.';
    if (/fetch|network|failed to fetch/i.test(msg)) return 'The authentication server could not be reached. Check the Supabase project status and configuration.';
    return msg;
  }

  function setAuthMessage(text, kind = '') {
    const hint = $('#authHint');
    if (!hint) return;
    hint.textContent = text;
    hint.className = `auth-hint ${kind}`.trim();
  }

  function updateHeader() {
    const button = $('#accountButton');
    const join = $('#joinButton');
    if (!button) return;
    if (currentUser) {
      const name = currentUser.user_metadata?.full_name || currentUser.email || currentUser.phone || 'Account';
      button.textContent = name.length > 18 ? `${name.slice(0, 17)}…` : name;
      if (join) join.textContent = 'Account';
    } else {
      button.textContent = 'Sign in';
      if (join) join.textContent = 'Join';
    }
  }

  function showAuthStep(step) {
    const contact = $('#authFormStep');
    const otp = $('#otpStep');
    const signed = $('#signedInStep');
    const footer = $('#authSwitchFoot');
    if (contact) contact.hidden = step !== 'contact';
    if (otp) otp.hidden = step !== 'otp';
    if (signed) signed.hidden = step !== 'signed';
    if (footer) footer.hidden = step === 'signed';
  }

  function renderSignedIn() {
    if (!currentUser) {
      $('#authTitle').textContent = pendingMode === 'signup' ? 'Create your account.' : 'Sign in.';
      showAuthStep('contact');
      return;
    }
    $('#authTitle').textContent = 'You are in.';
    $('#signedUserName').textContent = currentUser.user_metadata?.full_name || 'BTYA account';
    $('#signedUserContact').textContent = currentUser.email || currentUser.phone || 'Authenticated session';
    showAuthStep('signed');
  }

  function selectMethod(next) {
    method = next;
    $$('.auth-method').forEach(b => b.classList.toggle('active', b.dataset.authMethod === method));
    const label = $('#authIdentifierLabel');
    const input = $('#authIdentifier');
    if (method === 'email') {
      label?.firstChild && (label.firstChild.textContent = 'Email');
      if (input) {
        input.type = 'email';
        input.inputMode = 'email';
        input.autocomplete = 'email';
        input.placeholder = 'you@example.com';
      }
      setAuthMessage('A one-time code will be sent to your email. No password is required.');
    } else {
      label?.firstChild && (label.firstChild.textContent = 'Phone');
      if (input) {
        input.type = 'tel';
        input.inputMode = 'tel';
        input.autocomplete = 'tel';
        input.placeholder = '+91 98765 43210';
      }
      setAuthMessage('Phone OTP requires an SMS provider configured in the Supabase project.');
    }
  }

  function cleanPhone(value) { return value.trim().replace(/[()\-\s]/g, ''); }

  async function sendOtp({ signup = false } = {}) {
    if (!client) {
      setAuthMessage('Authentication is not connected. Check supabase-config.js.', 'auth-error');
      toast('Supabase authentication is not configured.');
      return;
    }

    const identifier = method === 'email'
      ? ($('#authIdentifier')?.value || '').trim().toLowerCase()
      : cleanPhone($('#authIdentifier')?.value || '');

    if (method === 'email' && !/^\S+@\S+\.\S+$/.test(identifier)) {
      setAuthMessage('Enter a valid email address.', 'auth-error');
      return;
    }
    if (method === 'phone' && !/^\+?[1-9]\d{7,14}$/.test(identifier)) {
      setAuthMessage('Use an international phone number, e.g. +919876543210.', 'auth-error');
      return;
    }

    pendingIdentifier = identifier;
    pendingMode = signup ? 'signup' : 'login';

    const options = { shouldCreateUser: signup };
    if (method === 'email') {
      options.emailRedirectTo = `${window.location.origin}${window.location.pathname}`;
    }

    if (signup) {
      const name = ($('#signupName')?.value || '').trim();
      const phone = cleanPhone($('#signupPhone')?.value || '');
      const email = ($('#signupEmail')?.value || '').trim().toLowerCase();
      const age = $('#signupAge')?.value || '';
      if (!name || !email || !phone) return toast('Real name, phone and email are required.');
      if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Enter a valid email address.');
      if (!/^\+?[1-9]\d{7,14}$/.test(phone)) return toast('Use an international phone number for the phone field.');
      options.data = { full_name: name, phone_number: phone, age: age || null, account_type: 'registered' };
      pendingIdentifier = email;
      method = 'email';
    }

    const payload = method === 'email' ? { email: pendingIdentifier, options } : { phone: pendingIdentifier, options };
    const { error } = await client.auth.signInWithOtp(payload);
    if (error) {
      setAuthMessage(friendlyError(error), 'auth-error');
      return;
    }

    $('#otpSentText').textContent = method === 'email'
      ? `Code sent to ${pendingIdentifier}. Check your inbox. If your Supabase email template uses a confirmation link instead, tapping that link will finish sign-in automatically.`
      : `Code sent to ${pendingIdentifier}.`;
    $('#otpInput').value = '';
    $('#otpInput').focus();
    showAuthStep('otp');
    toast('Authentication message sent.');
  }

  async function verifyOtp() {
    if (!client || !pendingIdentifier) return;
    const token = ($('#otpInput')?.value || '').trim();
    if (!/^\d{6,8}$/.test(token)) return toast('Enter the OTP you received.');

    const payload = method === 'email'
      ? { email: pendingIdentifier, token, type: 'email' }
      : { phone: pendingIdentifier, token, type: 'sms' };
    const { data, error } = await client.auth.verifyOtp(payload);
    if (error) {
      setAuthMessage(friendlyError(error), 'auth-error');
      return;
    }
    currentUser = data.user || null;
    updateHeader();
    renderSignedIn();
    toast('Authentication successful.');
    if (pendingMode === 'signup') closeModal($('#joinModal'));
  }

  async function signOut() {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) return toast(friendlyError(error));
    currentUser = null;
    updateHeader();
    renderSignedIn();
    toast('Signed out.');
    closeModal($('#authModal'));
  }

  function openAuth() {
    if (currentUser) renderSignedIn();
    else {
      $('#authTitle').textContent = 'Sign in.';
      showAuthStep('contact');
    }
    if (!ready) setAuthMessage('Supabase is not configured. Add the publishable key in supabase-config.js.', 'auth-error');
    openModal('authModal');
  }

  function openJoin() {
    if (currentUser) return openAuth();
    $('#signupName').focus();
    openModal('joinModal');
  }

  function openModal(id) {
    const el = $('#' + id);
    if (!el) return;
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(el) {
    if (!el) return;
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function bind() {
    $$('.auth-method').forEach(b => b.addEventListener('click', () => selectMethod(b.dataset.authMethod)));
    $('#sendOtpBtn')?.addEventListener('click', () => sendOtp());
    $('#verifyOtpBtn')?.addEventListener('click', verifyOtp);
    $('#changeIdentifierBtn')?.addEventListener('click', () => showAuthStep('contact'));
    $('#signOutBtn')?.addEventListener('click', signOut);
    $('#createAccountBtn')?.addEventListener('click', async () => {
      const email = ($('#signupEmail')?.value || '').trim().toLowerCase();
      if (!email) return toast('Email is required for the current Email OTP test.');
      $('#authIdentifier').value = email;
      closeModal($('#joinModal'));
      openModal('authModal');
      selectMethod('email');
      await sendOtp({ signup: true });
    });
    $('#accountButton')?.addEventListener('click', openAuth);
    $('#joinButton')?.addEventListener('click', openJoin);
    $$('[data-modal="authModal"]').forEach(b => b.addEventListener('click', openAuth));
    $$('[data-modal="joinModal"]').forEach(b => b.addEventListener('click', openJoin));
    $$('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(b.closest('.modal-backdrop'))));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop.open').forEach(closeModal);
    });

    selectMethod('email');

    if (client) {
      client.auth.getSession().then(({ data }) => {
        currentUser = data.session?.user || null;
        updateHeader();
      });
      client.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
        updateHeader();
        if (currentUser && document.querySelector('#authModal.open')) renderSignedIn();
      });
    } else updateHeader();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
