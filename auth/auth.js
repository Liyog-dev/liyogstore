
// auth.js
// ✅ Modular Authentication Logic for Liyogstore

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://snwwlewjriuqrodpjhry.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNud3dsZXdqcml1cXJvZHBqaHJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MDY3MDAsImV4cCI6MjA2ODE4MjcwMH0.WxOmEHxLcEHmMKFjsgrzcb22mPs-sJwW_G3GOuXX2c8";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const signupForm = document.getElementById("signup-form");
const loginForm = document.getElementById("login-form");
const forgotForm = document.getElementById("forgot-form");
const authMessage = document.getElementById("auth-message");

// ✅ Signup Logic
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("signup-username").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const phone = document.getElementById("signup-phone").value.trim();
    const location = document.getElementById("signup-location").value.trim();
    const referred_by = document.getElementById("signup-referral").value.trim();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          phone,
          referred_by,
          location,
        },
      },
    });

    if (error) {
      authMessage.textContent = error.message;
    } else {
      authMessage.style.color = "green";
      authMessage.textContent =
        "Signup successful! Please check your email to verify your account.";
      signupForm.reset();
    }
  });
}

// ✅ Login Logic
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      authMessage.textContent = error.message;
    } else {
      // Fetch role from public.users
      const {
        data: userData,
        error: userFetchError,
      } = await supabase
        .from("users")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (userFetchError) {
        authMessage.textContent = userFetchError.message;
        return;
      }

      if (userData.role === "admin") {
        window.location.href = "/admin/dashboard.html";
      } else {
        window.location.href = "/users/dashboard.html";
      }
    }
  });
}

// ✅ Password Reset Logic
if (forgotForm) {
  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("forgot-email").value.trim();

    const { data, error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      authMessage.textContent = error.message;
    } else {
      authMessage.style.color = "green";
      authMessage.textContent =
        "Reset email sent! Please check your inbox and follow the link.";
      forgotForm.reset();
    }
  });
}

// ✅ Auth State Change Listener (Optional for advanced redirect handling)
supabase.auth.onAuthStateChange((event, session) => {
  console.log("Auth state changed:", event);
});


