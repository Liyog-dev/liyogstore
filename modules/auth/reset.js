// ✅ File: auth/reset.js
import { supabase } from "../../config/supabase.js";
import { validateEmail } from "../../modules/utils/validate.js";

export async function resetPassword(email) {
  email = email.toLowerCase().trim();

  if (!validateEmail(email)) return { error: "Invalid email format." };

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://yourdomain.com/auth.html#reset-complete" // 🔄 Adjust as needed
  });

  if (error) return { error: error.message };
  return { success: true, message: "Password reset email sent." };
}

