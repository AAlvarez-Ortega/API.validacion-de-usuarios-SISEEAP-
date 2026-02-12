// ./JS/conneccionSB_App.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ✅ Proyecto 2 (BDD validación)
const SUPABASE_URL_APP = "https://wdgsvdjojwjebjrpgopn.supabase.co";
const SUPABASE_ANON_KEY_APP = "sb_publishable_TxHT2AsKDXlxYRGh0VgRMw_5VozTQ_p";

export const supabaseApp = createClient(SUPABASE_URL_APP, SUPABASE_ANON_KEY_APP);
