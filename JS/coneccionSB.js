import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
export const supabase = createClient(
  "https://wdgsvdjojwjebjrpgopn.supabase.co",
  "sb_publishable_TxHT2AsKDXlxYRGh0VgRMw_5VozTQ_p",
  { auth: { storage: window.sessionStorage, storageKey: "sisaep-panel-auth",
      persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    global: { fetch: (url, options = {}) => fetch(url, {
      ...options, signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000)
    }) }
  }
);
