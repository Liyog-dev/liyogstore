// config/supabase.js ✅

import { createClient } from "@supabase/supabase-js";

// Supabase Project Details
const SUPABASE_URL = "https://snwwlewjriuqrodpjhry.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNud3dsZXdqcml1cXJvZHBqaHJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MDY3MDAsImV4cCI6MjA2ODE4MjcwMH0.WxOmEHxLcEHmMKFjsgrzcb22mPs-sJwW_G3GOuXX2c8";

// Create and export Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

