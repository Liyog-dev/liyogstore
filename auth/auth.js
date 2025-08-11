
    // ============================
// Imports
// ============================
import { supabase } from '../config/supabase.js';
import { countries, populateCountries, populateStates } from './countries.js';

    /* --------------------------
       DOM references (keep IDs same)
       -------------------------- */
    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");
    const forgotForm = document.getElementById("forgot-form");
    const authMessage = document.getElementById("auth-message");
    const toggleSignup = document.getElementById("toggle-signup");
    const toggleLogin = document.getElementById("toggle-login");
    const toggleForgot = document.getElementById("toggle-forgot");
    const formTitle = document.getElementById("form-title");
    const toastEl = document.getElementById("toast");
   const themeToggle = document.getElementById("theme-toggle");
   const muteVoiceBtn = document.getElementById("mute-voice");

    /* --------------------------
       UI helpers: Toast & loading
       -------------------------- */
    function showToast(message, type = 'info', duration = 4000) {
      toastEl.innerHTML = '';
      const icon = document.createElement('div');
      icon.className = 'icon';
      icon.style.background = (type === 'error') ? 'var(--toast-error)' : 'var(--toast-success)';
      icon.textContent = (type === 'error') ? '!' : '✓';
      const txt = document.createElement('div');
      txt.style.flex = '1';
      txt.textContent = message;
      toastEl.appendChild(icon);
      toastEl.appendChild(txt);
      toastEl.classList.add('show');
      // 🔊 Speak toast text if voice is enabled
      speak(message);
      clearTimeout(showToast._to);
      showToast._to = setTimeout(() => toastEl.classList.remove('show'), duration);
    }
  
  

    function setFormLoading(form, isLoading = true) {
      [...form.elements].forEach(el => el.disabled = isLoading);
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.textContent = isLoading ? 'Please wait...' : (submit.dataset.orig || (submit.dataset.orig = submit.textContent));
    }

    /* --------------------------
       Theme toggle
       -------------------------- */
    function getTheme(){
      return document.documentElement.getAttribute('data-theme') || localStorage.getItem('theme') || 'light';
    }
    function applyTheme(t){
      document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
      localStorage.setItem('theme', t);
    }
    // initialize theme
    applyTheme(getTheme());
    themeToggle.addEventListener('click', () => applyTheme(getTheme() === 'dark' ? 'light' : 'dark'));

    /* --------------------------
       Toggle between forms (keeps your logic)
       -------------------------- */
    toggleSignup.addEventListener("click", () => {
      loginForm.classList.add("hidden");
      forgotForm.classList.add("hidden");
      signupForm.classList.remove("hidden");
      formTitle.innerText = "Sign Up";
      toggleSignup.classList.add("hidden");
      toggleLogin.classList.remove("hidden");
      authMessage.textContent = '';
    });

    toggleLogin.addEventListener("click", () => {
      signupForm.classList.add("hidden");
      forgotForm.classList.add("hidden");
      loginForm.classList.remove("hidden");
      formTitle.innerText = "Login";
      toggleSignup.classList.remove("hidden");
      toggleLogin.classList.add("hidden");
      authMessage.textContent = '';
    });

    toggleForgot.addEventListener("click", () => {
      signupForm.classList.add("hidden");
      loginForm.classList.add("hidden");
      forgotForm.classList.remove("hidden");
      formTitle.innerText = "Reset Password";
      toggleSignup.classList.remove("hidden");
      toggleLogin.classList.remove("hidden");
      authMessage.textContent = '';
    });

    /* --------------------------
       Password visibility toggles
       (uses same IDs so your functions are unchanged)
       -------------------------- */
    document.querySelectorAll('.pw-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.target;
        const input = document.getElementById(id);
        if (!input) return;
        if (input.type === 'password') {
          input.type = 'text';
          btn.textContent = '🙈';
        } else {
          input.type = 'password';
          btn.textContent = '👁';
        }
      });
    });

    /* --------------------------
       Voice greeting (Web Speech API)
       -------------------------- */
    let voiceEnabled = true;
    muteVoiceBtn.addEventListener('click', () => {
      voiceEnabled = !voiceEnabled;
      muteVoiceBtn.textContent = voiceEnabled ? '🎙️' : '🔕';
    });
    function speak(text) {
      if (!voiceEnabled || !("speechSynthesis" in window)) return;
      const msg = new SpeechSynthesisUtterance(text);
      msg.rate = 0.95;
      msg.pitch = 1;
      msg.lang = 'en-US';
      speechSynthesis.cancel();
      speechSynthesis.speak(msg);
    }

// ============================
// Country & State Selection
// ============================
populateCountries(countryEl);
countryEl.addEventListener('change', e => populateStates(stateEl, e.target.value));

    /* --------------------------
       Referral code generation & validation logic (server-checked)
       Core rules implemented here:
       1) Create a friendly code using name prefix + secure random suffix
       2) Ensure uniqueness by checking the users.referral_code column (loop until unique)
       3) If user supplied a referral, look up referring user's UUID and set referred_by
       4) Insert custom user record in 'users' table (id = auth.user.id)
       5) Default total_liyog_coins = 0, wallet_balance = 0
       NOTE: The robust place for final enforcement is server-side (DB constraint + RPC).
       -------------------------- */

    async function generateUniqueReferralCode(namePrefix) {
      // create a base prefix: letters only, short
      const prefix = (namePrefix || 'liyog').replace(/[^a-zA-Z]/g,'').substring(0,5).toLowerCase() || 'liyx';
      let attempt=0;
      while(attempt < 10) {
        attempt++;
        // random 6-character alphanumeric
        const suffix = Math.random().toString(36).slice(2, 8);
        const candidate = (prefix + suffix).toLowerCase();
        // check DB for uniqueness
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('referral_code', candidate)
          .maybeSingle(); // maybeSingle returns null if not found
        if (error) {
          // if there's an error reading DB, still continue attempts but log
          console.warn('Referral lookup error (attempt):', error);
        }
        if (!data) {
          // not found -> unique
          return candidate;
        }
        // else loop
      }
      // fallback: uuid fragment
      return prefix + crypto.randomUUID().split('-')[0];
    }

    async function resolveReferral(referredCode) {
      if (!referredCode) return null;
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('referral_code', referredCode)
        .maybeSingle();
      if (error) {
        console.warn('Referral resolve error:', error);
        return null;
      }
      return data ? data.id : null;
    }

  
    /* --------------------------
       Session handling & caching
       - We use Supabase client auth state + localStorage lightweight caching
       - For production, always fetch fresh profile server-side after login
       -------------------------- */
    function cacheProfile(profile) {
      try { localStorage.setItem('liyx_profile', JSON.stringify(profile)); } catch(e){/*ignore*/}
    }
    function getCachedProfile() {
      try { return JSON.parse(localStorage.getItem('liyx_profile') || 'null'); } catch(e){ return null }
    }

    supabase.auth.onAuthStateChange((event, session) => {
      // Listen for login/logout; update cache
      if (session && session.user) {
        const cached = getCachedProfile() || {};
        cached.id = session.user.id;
        cached.email = session.user.email;
        cacheProfile(cached);
      } else {
        localStorage.removeItem('liyx_profile');
      }
    });

    /* --------------------------
       Signup flow: keep your form ids & behavior intact
       -------------------------- */
    signupForm?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      authMessage.textContent = 'Creating account...';
      setFormLoading(signupForm, true);

      const name = document.getElementById('signup-username').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      const phone = document.getElementById('signup-phone').value.trim();
      const countryCode = document.getElementById('signup-country').value;
      const state = document.getElementById('signup-state').value;
      const referralInput = document.getElementById('signup-referral').value.trim();

      // Basic front-end validation
      if (!name || !email || !password) {
        showToast('Please complete required fields', 'error');
        setFormLoading(signupForm, false);
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Please enter a valid email', 'error');
        setFormLoading(signupForm, false);
        return;
      }
      if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        setFormLoading(signupForm, false);
        return;
      }
      if (!countryCode) {
        showToast('Please select a country', 'error');
        setFormLoading(signupForm, false);
        return;
      }
      const location = countryCode + (state ? `, ${state}` : '');

      // Resolve referral if provided (silently)
      let referred_by = null;
      if (referralInput) {
        const refId = await resolveReferral(referralInput);
        if (!refId) {
          showToast('Invalid referral code', 'error');
          setFormLoading(signupForm, false);
          return;
        }
        referred_by = refId;
      }

      // 1) create user in Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError || !authData?.user) {
        showToast('Signup error: ' + (signUpError?.message || 'Unknown'), 'error');
        setFormLoading(signupForm, false);
        return;
      }

      const userId = authData.user.id;

      // 2) generate unique referral code
      const referral_code = await generateUniqueReferralCode(name);

      // 3) insert into custom users table
      const { error: insertError } = await supabase
        .from('users')
        .insert([{
          id: userId,
          name,
          email,
          phone: phone || null,
          wallet_balance: 0,
          total_liyog_coins: 0,
          referred_by,
          role: 'user',
          location,
          is_active: true,
          referral_code
        }]);

      if (insertError) {
        // handle potential conflict on referral_code or other DB errors
        console.error('Insert error:', insertError);
        showToast('User insert error: ' + insertError.message, 'error');
        setFormLoading(signupForm, false);
        return;
      }

      // Success
      showToast('Signup successful! Check your email for verification.');
      authMessage.textContent = '';
      signupForm.reset();
      setFormLoading(signupForm, false);
      speak('Welcome to LiyX! Thanks for joining the revolution.');

      // Optionally redirect or pre-populate profile — for now we stay on page
    });

    /* --------------------------
       Login flow (keeps IDs)
       -------------------------- */
    loginForm?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      authMessage.textContent = 'Logging in...';
      setFormLoading(loginForm, true);

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      if (!email || !password) {
        showToast('Please enter email and password', 'error');
        setFormLoading(loginForm, false);
        return;
      }

      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError || !loginData?.user) {
        showToast('Login error: ' + (loginError?.message || 'Invalid credentials'), 'error');
        setFormLoading(loginForm, false);
        return;
      }

      const userId = loginData.user.id;
      // fetch user role and name from custom table
      const { data: userDetails, error: fetchError } = await supabase
        .from('users')
        .select('role, name, is_active')
        .eq('id', userId)
        .single();

      if (fetchError || !userDetails) {
        showToast('Error fetching user data', 'error');
        setFormLoading(loginForm, false);
        return;
      }

      if (userDetails.is_active === false) {
        showToast('Account deactivated. Contact support.', 'error');
        setFormLoading(loginForm, false);
        return;
      }

      // cache profile
      cacheProfile({ id: userId, email: loginData.user.email, name: userDetails.name, role: userDetails.role });
      showToast(`Welcome back, ${userDetails.name || ''}!`);
      speak(`Welcome back ${userDetails.name || 'friend'}`);

      // Update last_login (best done server-side via RPC; client will attempt a lightweight update)
      try {
        await supabase.from('users').update({ last_login: new Date() }).eq('id', userId);
      } catch (e) { console.warn('Failed to update last_login', e); }

      // Redirect based on role (client-side redirect; ensure server-side protections)
      setTimeout(() => {
        if (userDetails.role === 'admin') {
          window.location.href = '/admin/dashboard.html';
        } else {
          window.location.href = `/user/profile.html?id=${userId}`;
        }
      }, 900);
    });

    /* --------------------------
       Forgot password flow
       -------------------------- */
    forgotForm?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      setFormLoading(forgotForm, true);
      const email = document.getElementById('forgot-email').value.trim();
      if (!email) {
        showToast('Please enter your email', 'error');
        setFormLoading(forgotForm, false);
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) showToast(error.message, 'error');
      else showToast('Reset link sent to your email');
      setFormLoading(forgotForm, false);
    });

    /* --------------------------
       Phone verify placeholder
       - For phone verification via Supabase you can use otp (signInWithOtp).
       - Many flows require a separate phone-first sign-up; mixing both (email+password and phone otp)
         needs server-side decisions. Below we provide a helper to start phone OTP flow.
       -------------------------- */

    document.getElementById('signup-verify-phone').addEventListener('click', async () => {
      const phone = document.getElementById('signup-phone').value.trim();
      if (!phone) {
        showToast('Enter phone first to verify', 'error');
        return;
      }
      // Start OTP sign-in flow. Note: This expects phone auth enabled in Supabase.
      const { data, error } = await supabase.auth.signInWithOtp({ phone });
      if (error) {
        showToast('Phone OTP error: ' + error.message, 'error');
      } else {
        showToast('OTP sent to ' + phone + '. Complete verification on your device.');
      }
    });

    /* --------------------------
       On-load: attempt to prefill forms from cache
       -------------------------- */
    (function initFromCache(){
      const profile = getCachedProfile();
      if (profile?.email) document.getElementById('login-email').value = profile.email;
    })();

    /* --------------------------
       Final UX tweak: if page loaded with ?ref=..., prefill referral field
       -------------------------- */
    (function handleRefParam(){
      const params = new URLSearchParams(window.location.search);
      const r = params.get('ref');
      if (r) {
        const el = document.getElementById('signup-referral');
        if (el) el.value = r;
      }
    })();

  


