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
    if (/invalid.*otp|otp.*invalid|token.*invalid/i.test(msg)) return 'That OTP is invalid or expired.';
    if (/phone.*provider|sms|twilio|messagebird|vonage/i.test(msg)) return 'Phone OTP is not configured on the Supabase project yet. Email OTP is the current test path.';
    if (/fetch|network|failed to fetch/i.test(msg)) return 'The authentication server could not be reached. Check the Supabase project status and configuration.';
    return msg;
  }

  function setAuthMessage(text, kind='') {
    const hint = $('#authHint');
    if (!hint) return;
    hint.textContent = text;
    hint.className = `auth-hint ${kind}`;
  }

  function updateHeader() {
    const button = $('#accountButton');
    const join = $('#joinButton');
    if (!button) return;
    if (currentUser) {
      const name = currentUser.user_metadata?.full_name || currentUser.email || currentUser.phone || 'Account';
      button.textContent = name.length > 18 ? `${name.slice(0,17)}…` : name;
      if (join) join.textContent = 'Account';
    } else {
      button.textContent = 'Sign in';
      if (join) join.textContent = 'Join';
    }
  }

  function showAuthStep(step) {
    $('#authFormStep').hidden = step !== 'contact';
    $('#otpStep').hidden = step !== 'otp';
    $('#signedInStep').hidden = step !== 'signed';
    $('#authSwitchFoot').hidden = step === 'signed';
  }

  function renderSignedIn() {
    if (!currentUser) {
      showAuthStep('contact');
      $('#authTitle').textContent = 'Sign in.';
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
      label.firstChild.textContent = 'Email';
      input.type = 'email';
      input.inputMode = 'email';
      input.autocomplete = 'email';
      input.placeholder = 'you@example.com';
    } else {
      label.firstChild.textContent = 'Phone';
      input.type = 'tel';
      input.inputMode = 'tel';
      input.autocomplete = 'tel';
      input.placeholder = '+91 98765 43210';
    }
    setAuthMessage(method === 'email' ? 'A one-time code will be sent. No password is required.' : 'Phone OTP requires an SMS provider such as Twilio, Vonage or MessageBird on the Supabase project.');
  }

  function cleanPhone(value) {
    return value.trim().replace(/[()\-\s]/g, '');
  }

  async function sendOtp({signup=false} = {}) {
    if (!client) {
      setAuthMessage('Authentication is not connected yet. Add the Supabase publishable key in supabase-config.js.', 'auth-error');
      toast('Supabase authentication is not configured yet.');
      return;
    }
    const identifier = method === 'email' ? $('#authIdentifier').value.trim().toLowerCase() : cleanPhone($('#authIdentifier').value);
    if (method === 'email' && !/^\S+@\S+\.\S+$/.test(identifier)) return setAuthMessage('Enter a valid email address.', 'auth-error');
    if (method === 'phone' && !/^\+?[1-9]\d{7,14}$/.test(identifier)) return setAuthMessage('Use an international phone number, e.g. +919876543210.', 'auth-error');
    pendingIdentifier = identifier;
    pendingMode = signup ? 'signup' : 'login';

    const options = { shouldCreateUser: signup };
    if (signup) {
      const name = $('#signupName')?.value.trim();
      const phone = cleanPhone($('#signupPhone')?.value || '');
      const email = $('#signupEmail')?.value.trim().toLowerCase();
      const age = $('#signupAge')?.value || '';
      if (!name || !email || !phone) return toast('Real name, phone and email are required.');
      if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Enter a valid email address.');
      if (!/^\+?[1-9]\d{7,14}$/.test(phone)) return toast('Use an international phone number for the phone field.');
      options.data = { full_name: name, phone_number: phone, age: age || null, account_type: 'registered' };
    }

    const payload = method === 'email' ? { email: identifier, options } : { phone: identifier, options };
    const { error } = await client.auth.signInWithOtp(payload);
    if (error) {
      setAuthMessage(friendlyError(error), 'auth-error');
      return;
    }
    $('#otpSentText').textContent = method === 'email' ? `Code sent to ${identifier}. Check your inbox.` : `Code sent to ${identifier}.`;
    $('#otpInput').value = '';
    $('#otpInput').focus();
    showAuthStep('otp');
    toast('OTP sent.');
  }

  async function verifyOtp() {
    if (!client || !pendingIdentifier) return;
    const token = $('#otpInput').value.trim();
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
    if (currentUser) renderSignedIn(); else { $('#authTitle').textContent = 'Sign in.'; showAuthStep('contact'); }
    if (!ready) setAuthMessage('Test wiring is installed, but the Supabase publishable key is still missing.', 'auth-error');
  }

  function openJoin() {
    if (currentUser) { renderSignedIn(); openModal('authModal'); return; }
    $('#signupName').focus();
  }

  function openModal(id){const el=$('#'+id);if(!el)return;el.classList.add('open');el.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';}
  function closeModal(el){if(!el)return;el.classList.remove('open');el.setAttribute('aria-hidden','true');document.body.style.overflow='';}

  function bind() {
    $$('.auth-method').forEach(b => b.addEventListener('click', () => selectMethod(b.dataset.authMethod)));
    $('#sendOtpBtn')?.addEventListener('click', () => sendOtp());
    $('#verifyOtpBtn')?.addEventListener('click', verifyOtp);
    $('#changeIdentifierBtn')?.addEventListener('click', () => showAuthStep('contact'));
    $('#signOutBtn')?.addEventListener('click', signOut);
    $('#createAccountBtn')?.addEventListener('click', async () => {
      const email = $('#signupEmail').value.trim().toLowerCase();
      if (!email) return toast('Email is required for the current OTP test.');
      $('#authIdentifier').value = email;
      selectMethod('email');
      closeModal($('#joinModal'));
      openModal('authModal');
      await sendOtp({signup:true});
    });
    $('#accountButton')?.addEventListener('click', openAuth);
    $('#joinButton')?.addEventListener('click', openJoin);
    $$('[data-modal="authModal"]').forEach(b => b.addEventListener('click', openAuth));
    if (client) {
      client.auth.getSession().then(({data}) => {
        currentUser = data.session?.user || null;
        updateHeader();
      });
      client.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
        updateHeader();
      });
    } else updateHeader();
    selectMethod('email');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, {once:true}); else bind();
})();
