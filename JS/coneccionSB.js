
// JS/coneccionSB.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const URL_SUPABASE = "https://acxfppvfzjihgkvvljoq.supabase.co";
const CLAVE_PUBLICA_SUPABASE = "sb_publishable_8rTJbNVD_MdzSDZj6nS7ig_bDFK6s2a";

export const supabase = createClient(URL_SUPABASE, CLAVE_PUBLICA_SUPABASE, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
