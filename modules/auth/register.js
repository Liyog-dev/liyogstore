// ✅ File: auth/register.js
import { supabase } from "../../config/supabase.js";
import { validateEmail, validatePassword, validateFullName } from "../../modules/utils/validate.js";
import { generateReferralCode } from "../../modules/utils/format.js";

export async function registerUser({ email, password, full_name, referred_by = null }) {
  email = email.toLowerCase().trim();

  // Validation
  if (!validateEmail(email)) return { error: "Invalid email address." };
  if (!validatePassword(password)) return { error: "Password must be at least 8 characters." };
  if (!validateFullName(full_name)) return { error: "Please enter your full name." };

  // Check for duplicate email
  const { data: existing, error: existError } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) return { error: "Email already exists." };

  // Generate referral code
  const my_referral_code = generateReferralCode();

  // Create user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password
  });

  if (authError) return { error: authError.message };

  const user_id = authData.user.id;

  // Insert into 'users' table
  const { error: insertError } = await supabase.from("users").insert({
    id: user_id,
    email,
    full_name,
    referred_by: referred_by || null,
    referral_code: my_referral_code,
    created_at: new Date().toISOString()
  });

  if (insertError) {
    // rollback auth if user creation fails
    await supabase.auth.admin.deleteUser(user_id); // Optional: Admin key required
    return { error: "Registration failed. Please try again." };
  }

  return { success: true, message: "Registered successfully. Please verify your email." };
}
