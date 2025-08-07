
// ✅ File: auth/session.js
import { supabase } from "../../config/supabase.js";

// Check current session
export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return { error: error.message };
  return { session: data.session };
}

// Logout
export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) return { error: error.message };
  return { success: true };
}
