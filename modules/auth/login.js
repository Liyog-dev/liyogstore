// ✅ File: auth/login.js
import { supabase } from "../../config/supabase.js";
import { validateEmail, validatePassword } from "../../modules/utils/validate.js";

export async function loginUser({ email, password }) {
  email = email.toLowerCase().trim();

  if (!validateEmail(email)) return { error: "Invalid email format." };
  if (!validatePassword(password)) return { error: "Invalid password." };

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) return { error: error.message };

  // Optional: Update last login
  await supabase.from("users").update({ last_login: new Date().toISOString() }).eq("id", data.user.id);

  return { success: true, user: data.user };
}
