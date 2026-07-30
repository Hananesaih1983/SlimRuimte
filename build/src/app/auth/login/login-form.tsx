"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/** `?error=` codes the app redirects here with, mapped to their message key. */
const ERROR_MESSAGE_KEY: Record<string, string> = {
  auth_failed: "errors.authFailed",
  missing_role: "errors.missingRole",
  role_mismatch: "errors.roleMismatch",
};

/** Only allow same-origin, absolute-path redirects (no open redirect). */
function safeRedirect(target: string | undefined): string {
  if (!target || !target.startsWith("/") || target.startsWith("//")) {
    return "/dashboard";
  }
  return target;
}

export function LoginForm({
  redirectTo,
  initialError,
}: {
  redirectTo?: string;
  initialError?: string;
}) {
  const t = useTranslations("auth");
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const messageKey = initialError ? ERROR_MESSAGE_KEY[initialError] : undefined;
  const [error, setError] = useState<string | null>(
    messageKey ? t(messageKey) : null,
  );

  const destination = safeRedirect(redirectTo);

  async function handlePasswordLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const { error: signInError } = await createClient().auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(t("errors.invalidCredentials"));
      setPending(false);
      return;
    }

    router.replace(destination);
    router.refresh();
  }

  async function handleMagicLink() {
    if (!email) {
      return;
    }
    setError(null);
    setPending(true);

    const { error: otpError } = await createClient().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`,
      },
    });

    setPending(false);

    if (otpError) {
      setError(otpError.message);
      return;
    }

    setMagicLinkSent(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("login.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("login.subtitle")}</p>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {magicLinkSent ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">
          {t("login.magicLinkSent")}
        </p>
      ) : null}

      <form onSubmit={handlePasswordLogin} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            {t("emailLabel")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            {t("passwordLabel")}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <Button type="submit" size="lg" disabled={pending}>
          {t("login.submit")}
        </Button>
      </form>

      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={handleMagicLink}
        disabled={pending || !email}
      >
        {t("login.magicLink")}
      </Button>

      <p className="text-sm text-muted-foreground">
        {t("login.noAccount")}{" "}
        <Link href="/auth/register" className="text-primary underline-offset-4 hover:underline">
          {t("login.registerLink")}
        </Link>
      </p>
    </div>
  );
}
