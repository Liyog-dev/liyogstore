// auth/auth.js
import { supabase } from "../config/supabase.js";
import { registerUser } from "../modules/auth/register.js";
import { loginUser } from "../modules/auth/login.js";
import { resetPassword } from "../modules/auth/reset.js";
import { checkSession } from "../modules/auth/session.js";

// Handle Form Submissions
document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.querySelector("#register-form");
  const loginForm = document.querySelector("#login-form");
  const resetForm = document.querySelector("#reset-form");

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const full_name = registerForm.full_name.value.trim();
      const email = registerForm.email.value.trim().toLowerCase();
      const password = registerForm.password.value;
      const confirm_password = registerForm.confirm_password.value;
      const referred_by = new URLSearchParams(window.location.search).get("ref");

      if (password !== confirm_password) {
        alert("Passwords do not match!");
        return;
      }

      const { error } = await registerUser({
        full_name,
        email,
        password,
        referred_by,
      });

      if (error) return alert(error.message);
      alert("Registration successful! Please check your email to verify.");
      window.location.href = "/auth/auth.html#login";
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = loginForm.email.value.trim().toLowerCase();
      const password = loginForm.password.value;

      const { error } = await loginUser({ email, password });
      if (error) return alert(error.message);
      window.location.href = "/user/dashboard.html";
    });
  }

  if (resetForm) {
    resetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = resetForm.email.value.trim().toLowerCase();

      const { error } = await resetPassword(email);
      if (error) return alert(error.message);
      alert("Password reset email sent! Check your inbox.");
    });
  }

  checkSession();
});
