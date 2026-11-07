import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm";
export const supabaseUrl = "https://wdgsvdjojwjebjrpgopn.supabase.co";
export const supabasePublicKey = "sb_publishable_TxHT2AsKDXlxYRGh0VgRMw_5VozTQ_p";
export const supabase = createClient(
  supabaseUrl,
  supabasePublicKey,
  { auth: { storage: window.sessionStorage, storageKey: "sisaep-panel-auth",
      persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    global: { fetch: (url, options = {}) => fetch(url, {
      ...options, signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000)
    }) }
  }
);
