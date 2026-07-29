import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components.
 *
 * Cookie handling is delegated to the library's `document.cookie` fallback so
 * that the browser session stays in sync with the cookies written by the proxy
 * (`src/proxy.ts`) and the server client (`src/lib/supabase/server.ts`).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
