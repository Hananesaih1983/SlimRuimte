import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase auth callback — exchanges the PKCE `?code=` for a session cookie.
 *
 * Hit after email confirmation, magic link and password reset. Without this
 * route those flows silently fail (see 06_architecture.md: "callback/ —
 * REQUIRED: exchanges code for session").
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  // Supabase reports failures (expired link, denied consent) as query params.
  const authError = searchParams.get("error_description") ?? searchParams.get("error");

  if (authError || !code) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  // `next` lets callers resume where they left off; reject absolute URLs so
  // this cannot be used as an open redirect.
  const next = searchParams.get("next");
  const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  return NextResponse.redirect(`${origin}${destination}`);
}
