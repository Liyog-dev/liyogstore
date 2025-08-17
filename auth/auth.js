
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
// Signup Flow with Two-Step Verification + Spinner + Rollback
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

  try {
    // ===== Frontend Verification =====
    if (!name || !email || !password || !countryCode) throw new Error('Please fill in all required fields');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Oops! Your email seems invalid');
    if (password.length < 6) throw new Error('Password too short! Must be at least 6 characters');
    if (phone) {
      if (!validatePhoneFormat(phone)) throw new Error('Phone number format is incorrect');
      if (!(await isPhoneUnique(phone))) throw new Error('This phone number is already registered');
    }

    // Referral code
    let referred_by = null;
    if (referralInput) {
      referred_by = await resolveReferral(referralInput);
      if (!referred_by) throw new Error('Hmm, the referral code seems invalid');
    }

    showToast('All checks passed! Preparing to create your account...', 'success', 3000);
    const verificationSpinner = document.createElement('div');
    verificationSpinner.className = 'verification-spinner';
    verificationSpinner.textContent = '🔄 Verifying...';
    signupForm.appendChild(verificationSpinner);

    // ===== Backend Signup =====
    const location = countryCode + (state ? `, ${state}` : '');
    const { data: authData, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError || !authData?.user) throw new Error('Oops! Could not create your account. Please try again');

    // ===== Insert into Custom Users Table =====
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
      // ===== Rollback Auth User via Edge Function =====
      const rollbackResponse = await fetch('https://snwwlewjriuqrodpjhry.supabase.co/functions/v1/rollback-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: authData.user.id, secret_key: 'liyog@12#32##' })
      });
      const rollbackResult = await rollbackResponse.json();

      if (rollbackResult.success) {
        throw new Error('Something went wrong while creating your account. We have rolled back your registration. Please try again.');
      } else {
        throw new Error('Something went wrong while creating your account. Also, rollback failed. Please contact support.');
      }
    }

    // ===== Success =====
    showToast('Account created successfully! Check your email to verify your account', 'success');
    signupForm.reset();
    speak('Welcome to LiyX!');
    setTimeout(() => {
      window.location.href = `/user/profile.html?id=${authData.user.id}`;
    }, 900);

  } catch (err) {
    console.error(err);
    showToast(err.message || 'Unexpected error occurred. Please try again later', 'error');
  } finally {
    setFormLoading(signupForm, false);
    document.querySelectorAll('.verification-spinner').forEach(el => el.remove());
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

                  
