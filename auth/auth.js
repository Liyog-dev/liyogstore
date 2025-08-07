import { supabase } from './config/supabase.js' // ensure supabase is correctly initialized
import { toast } from 'react-toastify' // or replace with your own toast handler
import { v4 as uuidv4 } from 'uuid'

// Utility to generate a short unique referral code
function generateReferralCode(name = '') {
  const code = name?.slice(0, 3).toUpperCase() + Math.random().toString(36).substring(2, 7).toUpperCase()
  return code
}

/**
 * Sign up a new user with optional referral code
 * @param {Object} userData - User data
 * @param {string} userData.name
 * @param {string} userData.email
 * @param {string} userData.password
 * @param {string} userData.phone
 * @param {string} userData.location
 * @param {string} [userData.referral_code] - optional
 */
export const signUpUser = async (userData) => {
  const {
    name,
    email,
    password,
    phone,
    location,
    referral_code
  } = userData

  // === VALIDATION ===
  if (!name || !email || !password || !phone || !location) {
    toast.error("All fields are required.")
    return { success: false, message: "Missing fields" }
  }

  try {
    // === HANDLE REFERRAL LOOKUP ===
    let referredBy = null
    if (referral_code) {
      const { data: refData, error: refError } = await supabase
        .from('users')
        .select('id')
        .eq('referral_code', referral_code)
        .single()

      if (refError || !refData) {
        toast.error("Invalid referral code provided.")
        return { success: false, message: "Invalid referral code" }
      }

      referredBy = refData.id
    }

    // === CREATE USER ACCOUNT ===
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      toast.error(authError.message || "Failed to sign up.")
      return { success: false, message: authError.message }
    }

    const userId = authData.user.id
    const referralCode = generateReferralCode(name)

    // === INSERT USER PROFILE ===
    const { error: insertError } = await supabase.from('users').insert({
      id: userId,
      name,
      email,
      phone,
      location,
      wallet_balance: 0,
      total_liyog_coins: 0,
      role: 'user',
      referred_by: referredBy,
      referral_code: referralCode,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profile_image: '',
      bio: '',
    })

    if (insertError) {
      toast.error("Sign up succeeded, but failed to save profile.")
      return { success: false, message: "Profile creation failed" }
    }

    toast.success("Account created successfully. Please check your email to verify your account.")
    return { success: true }

  } catch (err) {
    toast.error("An unexpected error occurred.")
    console.error("SignUp Error:", err)
    return { success: false, message: "Unexpected error" }
  }
}
