// JS/coneccionSB.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL_SUPABASE = "https://acxfppvfzjihgkvvljoq.supabase.co";
const CLAVE_PUBLICA_SUPABASE = "sb_publishable_8rTJbNVD_MdzSDZj6nS7ig_bDFK6s2a";

export const supabase = createClient(URL_SUPABASE, CLAVE_PUBLICA_SUPABASE, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
