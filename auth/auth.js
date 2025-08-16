
// ============================
// Imports
// ============================
import { supabase } from '../config/supabase.js';
import { countries, populateCountries, populateStates } from './countries.js';

// ============================
// DOM References
// ============================
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
const countryEl = document.getElementById('signup-country');
const stateEl = document.getElementById('signup-state');

// ============================
// UI Helpers
// ============================
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
  speak(message);
  clearTimeout(showToast._to);
  showToast._to = setTimeout(() => toastEl.classList.remove('show'), duration);
}

function setFormLoading(form, isLoading = true) {
  [...form.elements].forEach(el => el.disabled = isLoading);
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.textContent = isLoading ? 'Please wait...' : (submit.dataset.orig || (submit.dataset.orig = submit.textContent));
}

// ============================
// Theme Toggle
// ============================
function updateThemeIcon(theme) {
  if (!themeToggle) return;
  themeToggle.textContent = theme === 'dark' ? '🌞' : '🌓';
}

function getTheme() {
  return document.documentElement.getAttribute('data-theme') || localStorage.getItem('theme') || 'light';
}

function applyTheme(t) {
  const theme = t === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  updateThemeIcon(theme);
}

applyTheme(getTheme());

themeToggle.addEventListener('click', () => {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
});

// ============================
// Form Toggles
// ============================
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

// ============================
// Password Visibility Toggle
// ============================
document.querySelectorAll('.pw-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁' : '🙈';
  });
});

// ============================
// Voice Greeting
// ============================
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

// ============================
// Phone Validation & Uniqueness Helpers
// ============================
function validatePhoneFormat(phone) {
  const phoneRegex = /^\+?[1-9]\d{6,14}$/; // E.164 format basic check
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

async function isPhoneUnique(phone) {
  if (!phone) return true;
  const cleanedPhone = phone.replace(/[\s\-\(\)]/g, '');
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('phone', cleanedPhone)
    .maybeSingle();
  if (error) {
    console.error("Error checking phone uniqueness:", error.message);
    showToast('Error checking phone number. Try again.', 'error');
    return false;
  }
  return !data;
}

// ============================
// Referral Code Helpers
// ============================
async function generateUniqueReferralCode(namePrefix) {
  const prefix = (namePrefix || 'liyog').replace(/[^a-zA-Z]/g, '').substring(0, 5).toLowerCase() || 'liyx';
  let attempt = 0;
  while (attempt < 10) {
    attempt++;
    const suffix = Math.random().toString(36).slice(2, 8);
    const candidate = (prefix + suffix).toLowerCase();
    const { data, error } = await supabase.from('users').select('id').eq('referral_code', candidate).maybeSingle();
    if (!data) return candidate;
  }
  return prefix + crypto.randomUUID().split('-')[0];
}

async function resolveReferral(referredCode) {
  if (!referredCode) return null;
  const { data, error } = await supabase.rpc('resolve_referral', { ref_code: referredCode });
if (error) {
  console.error('Error resolving referral:', error.message);
  return null;
}
return data ?? null;
}

// ============================
// Session Handling
// ============================
function cacheProfile(profile) {
  try { localStorage.setItem('liyx_profile', JSON.stringify(profile)); } catch {}
}
function getCachedProfile() {
  try { return JSON.parse(localStorage.getItem('liyx_profile') || 'null'); } catch { return null }
}
supabase.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    const cached = getCachedProfile() || {};
    cached.id = session.user.id;
    cached.email = session.user.email;
    cacheProfile(cached);
  } else {
    localStorage.removeItem('liyx_profile');
  }
});

// ============================
// Signup Flow with Full Pre-Check
// ============================
signupForm?.addEventListener('submit', async ev => {
  ev.preventDefault();

  authMessage.textContent = '';
  setFormLoading(signupForm, true);

  // ===== Collect Input Values =====
  const name = document.getElementById('signup-username').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const phone = document.getElementById('signup-phone').value.trim();
  const countryCode = document.getElementById('signup-country').value;
  const state = document.getElementById('signup-state').value;
  const referralInput = document.getElementById('signup-referral').value.trim();

  // ===== Step 1: Frontend Verification =====
  if (!name || !email || !password || !countryCode) {
    showToast('Please fill in all required fields', 'error');
    setFormLoading(signupForm, false);
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Oops! Your email seems invalid', 'error');
    setFormLoading(signupForm, false);
    return;
  }
  if (password.length < 6) {
    showToast('Password too short! Must be at least 6 characters', 'error');
    setFormLoading(signupForm, false);
    return;
  }
  if (phone && !validatePhoneFormat(phone)) {
    showToast('Phone number format is incorrect', 'error');
    setFormLoading(signupForm, false);
    return;
  }

  // ===== Step 2: Check duplicates BEFORE signup =====
  try {
    // Check email uniqueness
    const { data: emailCheck, error: emailErr } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (emailErr) throw emailErr;
    if (emailCheck) {
      showToast('This email is already registered. Try logging in', 'error');
      setFormLoading(signupForm, false);
      return;
    }

    // Check phone uniqueness
    if (phone) {
      const phoneCleaned = phone.replace(/[\s-]/g, '');
      const { data: phoneCheck, error: phoneErr } = await supabase
        .from('users')
        .select('id')
        .eq('phone', phoneCleaned)
        .maybeSingle();

      if (phoneErr) throw phoneErr;
      if (phoneCheck) {
        showToast('This phone number is already registered', 'error');
        setFormLoading(signupForm, false);
        return;
      }
    }

  } catch (dupErr) {
    console.error("Duplicate check failed:", dupErr);
    showToast('Error checking existing accounts. Please try again', 'error');
    setFormLoading(signupForm, false);
    return;
  }

  // ===== Step 3: Referral Code =====
  let referred_by = null;
  if (referralInput) {
    referred_by = await resolveReferral(referralInput);
    if (!referred_by) {
      showToast('Hmm, the referral code seems invalid', 'error');
      setFormLoading(signupForm, false);
      return;
    }
  }

  showToast('All checks passed! Preparing to create your account...', 'success', 2000);

  // ===== Step 4: Backend Signup =====
  const location = countryCode + (state ? `, ${state}` : '');
  try {
    // Create auth user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError || !authData?.user) {
      showToast('Oops! Could not create your account. Please try again', 'error');
      setFormLoading(signupForm, false);
      return;
    }

    // Insert into custom users table
    const referral_code = await generateUniqueReferralCode(name);
    const { error: insertError } = await supabase.from('users').insert([{
      id: authData.user.id,
      name,
      email,
      phone: phone ? phone.replace(/[\s-]/g, '') : null,
      wallet_balance: 0,
      total_liyog_coins: 0,
      referred_by,
      role: 'user',
      location,
      is_active: true,
      referral_code
    }]);

    if (insertError) {
      // Rollback auth user via edge function
      await fetch('https://snwwlewjriuqrodpjhry.supabase.co/functions/v1/rollback-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: authData.user.id,
          secret_key: 'liyog@12#32##'
        })
      });

      showToast('Something went wrong while creating your account. Please try again', 'error');
      setFormLoading(signupForm, false);
      return;
    }

    // ===== Success =====
    showToast('Account created successfully! Check your email to verify your account', 'success');
    signupForm.reset();
    speak('Welcome to LiyX!');
    setFormLoading(signupForm, false);

    setTimeout(() => {
      window.location.href = `/user/profile.html?id=${authData.user.id}`;
    }, 900);

  } catch (err) {
    console.error('Unexpected signup error:', err);
    showToast('Unexpected error occurred. Please try again later', 'error');
    setFormLoading(signupForm, false);
  }
});

// ============================
// Login Flow
// ============================
loginForm?.addEventListener('submit', async ev => {
  ev.preventDefault();
  authMessage.textContent = 'Logging in...';
  setFormLoading(loginForm, true);

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showToast('Enter email and password', 'error');
    setFormLoading(loginForm, false);
    return;
  }

  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
  if (loginError || !loginData?.user) {
    showToast('Invalid credentials', 'error');
    setFormLoading(loginForm, false);
    return;
  }

  const { data: userDetails } = await supabase.from('users').select('role, name, is_active').eq('id', loginData.user.id).single();
  if (!userDetails || userDetails.is_active === false) {
    showToast('Account deactivated', 'error');
    setFormLoading(loginForm, false);
    return;
  }

  cacheProfile({ id: loginData.user.id, email: loginData.user.email, name: userDetails.name, role: userDetails.role });
  showToast(`Welcome back, ${userDetails.name || ''}!`);
  speak(`Welcome back ${userDetails.name || 'friend'}`);

  await supabase.from('users').update({ last_login: new Date() }).eq('id', loginData.user.id);
  setTimeout(() => {
    window.location.href = userDetails.role === 'admin' ? '/admin/dashboard.html' : `/user/profile.html?id=${loginData.user.id}`;
  }, 900);
});

// ============================
// Forgot Password
// ============================
forgotForm?.addEventListener('submit', async ev => {
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
  else showToast('Reset link sent');
  setFormLoading(forgotForm, false);
});

// ============================
// Phone Verify Placeholder
// ============================
document.getElementById('signup-verify-phone')?.addEventListener('click', async () => {
  const phone = document.getElementById('signup-phone').value.trim();
  if (!phone) {
    showToast('Enter phone first', 'error');
    return;
  }
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) showToast('Phone OTP error: ' + error.message, 'error');
  else showToast(`OTP sent to ${phone}`);
});

// ============================
// Init from Cache
// ============================
(function initFromCache() {
  const profile = getCachedProfile();
  if (profile?.email) document.getElementById('login-email').value = profile.email;
})();

// ============================
// Handle Referral from URL
// ============================
(function handleRefParam() {
  const r = new URLSearchParams(window.location.search).get('ref');
  if (r) document.getElementById('signup-referral').value = r;
})();

                  
