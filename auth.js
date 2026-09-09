(() => {
  const cfg = window.BTYA_SUPABASE_CONFIG || {};
  const ready = Boolean(window.supabase && cfg.url && cfg.publishableKey && !cfg.publishableKey.includes('PASTE_'));
  const client = ready ? window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) : null;
  window.BTYASupabase = client;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  let pendingIdentifier = '';
  let pendingMode = 'login';
  let signupProfile = null;
  let currentUser = null;
  let otpCooldownUntil = 0;
  let otpCooldownTimer = null;

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
    const code = String(error.code || '');
    const msg = String(error.message || error.error_description || error);
    if (code === 'over_email_send_rate_limit') return 'Supabase has temporarily limited email OTPs for this address. Wait and try again later.';
    if (code === 'over_request_rate_limit') return 'Too many OTP requests from this connection. Wait a few minutes and try again.';
    if (/rate limit/i.test(msg)) return 'Too many attempts. Wait a little and try again.';
    if (/invalid.*otp|otp.*invalid|token.*invalid|expired/i.test(msg)) return 'That code is invalid or expired.';
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
      const name = currentUser.user_metadata?.full_name || currentUser.email || 'Account';
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
    const footer = $('#authSwitchFooter');
    if (contact) contact.hidden = step !== 'contact';
    if (otp) otp.hidden = step !== 'otp';
    if (signed) signed.hidden = step !== 'signed';
    if (footer) footer.hidden = step !== 'contact';
  }

  function renderSignedIn() {
    if (!currentUser) {
      $('#authTitle').textContent = pendingMode === 'signup' ? 'Create your account.' : 'Sign in.';
      showAuthStep('contact');
      return;
    }
    $('#authTitle').textContent = 'You are in.';
    $('#signedUserName').textContent = currentUser.user_metadata?.full_name || 'BTYA account';
    $('#signedUserContact').textContent = currentUser.email || 'Authenticated session';
    showAuthStep('signed');
  }


  function setOtpCooldown(seconds = 60) {
    const button = $('#sendOtpBtn');
    otpCooldownUntil = Date.now() + seconds * 1000;
    clearInterval(otpCooldownTimer);

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((otpCooldownUntil - Date.now()) / 1000));
      if (button) {
        button.disabled = remaining > 0;
        button.textContent = remaining > 0 ? `Wait ${remaining}s` : 'Send OTP';
      }
      if (!remaining) clearInterval(otpCooldownTimer);
    };
    tick();
    otpCooldownTimer = setInterval(tick, 1000);
  }

  function otpCooldownRemaining() {
    return Math.max(0, Math.ceil((otpCooldownUntil - Date.now()) / 1000));
  }

  async function sendOtp({ signup = false } = {}) {
    const cooldown = otpCooldownRemaining();
    if (cooldown > 0) return toast(`Please wait ${cooldown}s before requesting another OTP.`);
    if (!client) {
      setAuthMessage('Authentication is not connected. Check supabase-config.js.', 'auth-error');
      toast('Supabase authentication is not configured.');
      return;
    }

    const email = ($('#authIdentifier')?.value || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setAuthMessage('Enter a valid email address.', 'auth-error');
      return;
    }
    pendingIdentifier = email;
    pendingMode = signup ? 'signup' : 'login';

    const options = { shouldCreateUser: signup };
    if (signup) {
      const profile = signupProfile || {};
      const name = profile.name || '';
      const phone = profile.phone || '';
      const profileEmail = profile.email || '';
      const age = profile.age || '';
      if (!name || !profileEmail || !phone) return toast('Real name, phone and email are required.');
      if (!/^\S+@\S+\.\S+$/.test(profileEmail)) return toast('Enter a valid email address.');
      if (profileEmail !== email) return toast('Use the same email address you entered for your account.');
      options.data = { full_name: name, phone_number: phone, age: age || null, account_type: 'registered' };
    }

    const { error } = await client.auth.signInWithOtp({ email: pendingIdentifier, options });
    if (error) {
      const message = friendlyError(error);
      setAuthMessage(message, 'auth-error');
      if (/rate limit|too many attempts/i.test(String(error.message || error))) setOtpCooldown(60);
      return;
    }
    setOtpCooldown(60);
    $('#authTitle').textContent = 'Enter your code.';
    $('#otpSentText').textContent = `Code sent to ${pendingIdentifier}. Check your inbox.`;
    $('#otpInput').value = '';
    $('#otpInput').focus();
    showAuthStep('otp');
    toast('Authentication email sent.');
  }

  async function verifyOtp() {
    if (!client || !pendingIdentifier) return;
    const token = ($('#otpInput')?.value || '').trim();
    if (!/^\d{6,8}$/.test(token)) return toast('Enter the OTP you received.');
    const { data, error } = await client.auth.verifyOtp({ email: pendingIdentifier, token, type: 'email' });
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
    $('#signupName')?.focus();
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
    $('#signupPhone')?.addEventListener('input', e => {
      e.target.value = e.target.value.replace(/\D/g, '');
    });
    $('#otpInput')?.addEventListener('input', e => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
    });
    $('#sendOtpBtn')?.addEventListener('click', () => sendOtp({ signup: pendingMode === 'signup' }));
    $('#verifyOtpBtn')?.addEventListener('click', verifyOtp);
    $('#changeIdentifierBtn')?.addEventListener('click', () => showAuthStep('contact'));
    $('#signOutBtn')?.addEventListener('click', signOut);
    $('#createAccountBtn')?.addEventListener('click', () => {
      const name = ($('#signupName')?.value || '').trim();
      const phone = ($('#signupPhone')?.value || '').replace(/\D/g, '');
      const email = ($('#signupEmail')?.value || '').trim().toLowerCase();
      const age = $('#signupAge')?.value || '';
      if (!name || !phone || !email) return toast('Real name, phone and email are required.');
      if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Enter a valid email address.');

      signupProfile = { name, phone, email, age };
      pendingMode = 'signup';
      pendingIdentifier = email;
      window.__btyaEmailContact = email;
      closeModal($('#joinModal'));
      openModal('authModal');
      const authIdentifier = $('#authIdentifier');
      if (authIdentifier) authIdentifier.value = email;
      renderSignedIn();
    });
    $('#accountButton')?.addEventListener('click', openAuth);
    $('#joinButton')?.addEventListener('click', openJoin);
    $$('[data-modal="authModal"]').forEach(b => b.addEventListener('click', openAuth));
    $$('[data-modal="joinModal"]').forEach(b => b.addEventListener('click', openJoin));
    $$('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(b.closest('.modal'))));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') document.querySelectorAll('.modal.open').forEach(closeModal);
    });

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
