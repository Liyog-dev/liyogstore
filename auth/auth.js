// auth.js
import { supabase } from 'liyogstore/config/supabase.js';

const signupForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');
const resetForm = document.getElementById('reset-form');
const tabs = document.querySelectorAll('[data-tab]');

// === Referral code from URL ===
const urlParams = new URLSearchParams(window.location.search);
const referralCode = urlParams.get('ref');
if (referralCode) {
  document.getElementById('referral').value = referralCode;
}

// === Show Toast ===
function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `fixed top-5 right-5 z-50 px-4 py-2 rounded shadow-md text-white ${
    type === 'success' ? 'bg-green-600' : 'bg-red-600'
  }`;
  toast.innerText = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// === Tab Switch Logic ===
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('[data-tab-content]').forEach(el => el.classList.add('hidden'));
    document.querySelector(tab.dataset.tabTarget).classList.remove('hidden');
  });
});

// === Sign Up ===
signupForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = signupForm['email'].value;
  const password = signupForm['password'].value;
  const name = signupForm['name'].value;
  const location = signupForm['location'].value;
  const phone = signupForm['phone'].value;
  const referral = signupForm['referral'].value || null;

  if (!email || !password || !name || !location || !phone) {
    return showToast('All fields are required', 'error');
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) return showToast(signUpError.message, 'error');

  const user = signUpData.user;

  if (user) {
    const { error: insertError } = await supabase.from('users').insert([
      {
        id: user.id,
        email,
        name,
        location,
        phone,
        referral,
        role: 'user',
      }
    ]);

    if (insertError) return showToast('Signup succeeded but failed to save user details.', 'error');

    showToast('Signup successful! Please check your email to verify.');
  }
});

// === Login ===
loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = loginForm['email'].value;
  const password = loginForm['password'].value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return showToast(error.message, 'error');

  const user = data.user;

  if (user) {
    const { data: userDetails, error: fetchError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (fetchError) return showToast('Login succeeded, but could not fetch user role.', 'error');

    const role = userDetails?.role || 'user';

    showToast(`Welcome ${role}!`);

    setTimeout(() => {
      if (role === 'admin') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/dashboard';
      }
    }, 1000);
  }
});

// === Password Reset ===
resetForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = resetForm['email'].value;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset.html',
  });

  if (error) return showToast(error.message, 'error');

  showToast('Password reset email sent!');
});
