// js/conexionSB.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = "https://acxfppvfzjihgkvvljoq.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_8rTJbNVD_MdzSDZj6nS7ig_bDFK6s2a";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
