import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

/**
 * Session-refresh helper used by `src/proxy.ts`.
 *
 * Creates a request-scoped Supabase client whose `setAll` writes refreshed auth
 * cookies onto BOTH the forwarded request (so the current render sees the new
 * tokens) and the outgoing response (so the browser stores them).
 *
 * Returns the (possibly rewritten) response plus the authenticated user so the
 * proxy can make routing decisions without a second round-trip.
 *
 * IMPORTANT: `supabase.auth.getUser()` must be called here — it is what
 * triggers the token refresh. Removing it silently logs users out.
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  user: User | null;
}> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Responses that set auth cookies must never be cached by a CDN,
          // otherwise one user's session can be served to another.
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
