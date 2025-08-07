// Add this inside a <script type="module"> or in a JS file
import { supabase } from './config/supabase.js';

// DOM Elements
const signupForm = document.getElementById('signup-form');
const messageBox = document.getElementById('auth-message');

// UTIL: Generate Unique Referral Code
function generateReferralCode(name) {
  const base = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random
  return `${base}${random}`;
}

// ✅ Sign-Up Function
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Clear message
  messageBox.textContent = '';

  // Gather input values
  const name = document.getElementById('signup-username').value.trim();
  const email = document.getElementById('signup-email').value.trim().toLowerCase();
  const password = document.getElementById('signup-password').value.trim();
  const phone = document.getElementById('signup-phone').value.trim();
  const location = document.getElementById('signup-location').value.trim();
  const referralCodeInput = document.getElementById('signup-referral').value.trim();

  // Step 1: Create Auth User
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });

  if (signUpError) {
    messageBox.textContent = signUpError.message;
    return;
  }

  const userId = signUpData.user.id;

  // Step 2: Resolve referred_by if referral code provided
  let referredBy = null;
  if (referralCodeInput !== '') {
    const { data: refUser, error: refError } = await supabase
      .from('users')
      .select('id')
      .eq('referral_code', referralCodeInput)
      .single();

    if (refError || !refUser) {
      messageBox.textContent = 'Invalid referral code.';
      return;
    }

    referredBy = refUser.id;
  }

  // Step 3: Generate unique referral code for new user
  let newReferralCode = generateReferralCode(name);
  let isUnique = false;

  while (!isUnique) {
    const { data: existing, error } = await supabase
      .from('users')
      .select('id')
      .eq('referral_code', newReferralCode)
      .single();

    if (!existing) {
      isUnique = true;
    } else {
      newReferralCode = generateReferralCode(name);
    }
  }

  // Step 4: Insert into Custom Users Table
  const { error: insertError } = await supabase
    .from('users')
    .insert([
      {
        id: userId,
        name,
        email,
        phone,
        location,
        role: 'user',
        referred_by: referredBy,
        referral_code: newReferralCode,
        is_active: true
      }
    ]);

  if (insertError) {
    messageBox.textContent = 'Error saving user details: ' + insertError.message;
    return;
  }

  // Step 5: Redirect to Dashboard
  window.location.href = 'https://liyogworld.com.ng';
});

// ✅ Fill referral from URL param (already handled in your HTML script)
// So we don’t need to repeat it here
