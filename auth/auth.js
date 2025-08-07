// auth/auth.js
import { supabase } from "../config/supabase.js";

// --------------------- Utilities ---------------------

function validateEmail(email) {
  const regex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
  return regex.test(email);
}

function validatePassword(password) {
  return password.length >= 6;
}

function formatName(name) {
  return name
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function showError(message) {
  const msgBox = document.getElementById("auth-message");
  if (msgBox) {
    msgBox.innerText = message;
    msgBox.style.color = "red";
  } else {
    alert(message);
  }
}

function clearMessage() {
  const msgBox = document.getElementById("auth-message");
  if (msgBox) msgBox.innerText = "";
}

// --------------------- Register ---------------------

async function registerUser({ full_name, email, password, phone, location, referred_by }) {
  if (!validateEmail(email)) return { error: { message: "Invalid email address" } };
  if (!validatePassword(password)) return { error: { message: "Password must be at least 6 characters" } };

  const formattedName = formatName(full_name);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: formattedName,
        phone,
        location,
        referred_by,
        joined_at: new Date().toISOString(),
      },
    },
  });

  return { data, error };
}

// --------------------- Login ---------------------

async function loginUser({ email, password }) {
  if (!validateEmail(email)) return { error: { message: "Invalid email address" } };
  if (!password) return { error: { message: "Password is required" } };

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
}

// --------------------- Reset Password ---------------------

async function resetPassword(email) {
  if (!validateEmail(email)) return { error: { message: "Invalid email address" } };

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/auth.html`,
  });

  return { data, error };
}

// --------------------- Session Check ---------------------

async function checkSession() {
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (session && session.user) {
    // Redirect to dashboard if already logged in
    if (window.location.pathname.includes("/auth")) {
      window.location.href = "/user/dashboard.html";
    }
  }
}

// --------------------- DOM Handlers ---------------------

document.addEventListener("DOMContentLoaded", () => {
  checkSession();

  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");
  const forgotForm = document.getElementById("forgot-form");

  // Register
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessage();

      const full_name = document.getElementById("signup-username").value.trim();
      const email = document.getElementById("signup-email").value.trim().toLowerCase();
      const password = document.getElementById("signup-password").value;
      const phone = document.getElementById("signup-phone").value.trim();
      const location = document.getElementById("signup-location").value.trim();
      const referred_by = document.getElementById("signup-referral").value.trim();

      const { error } = await registerUser({ full_name, email, password, phone, location, referred_by });

      if (error) return showError(error.message);

      alert("Registration successful! Please check your email to verify.");
      window.location.href = "/auth/auth.html";
    });
  }

  // Login
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessage();

      const email = document.getElementById("login-email").value.trim().toLowerCase();
      const password = document.getElementById("login-password").value;

      const { error } = await loginUser({ email, password });

      if (error) return showError(error.message);

      window.location.href = "/user/dashboard.html";
    });
  }

  // Forgot Password
  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessage();

      const email = document.getElementById("forgot-email").value.trim().toLowerCase();
      const { error } = await resetPassword(email);

      if (error) return showError(error.message);
      alert("Password reset email sent. Please check your inbox.");
    });
  }
});
