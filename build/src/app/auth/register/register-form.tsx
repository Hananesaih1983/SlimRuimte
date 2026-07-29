"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { REGISTERABLE_ROLES, type RegisterableRole } from "@/lib/roles";

/**
 * Two-step registration: pick a role, then enter credentials.
 *
 * The role is written to `user_metadata.role` at sign-up. The
 * `handle_new_user()` trigger copies it into `public.users.role`, and the proxy
 * reads it back from the JWT for routing.
 */
export function RegisterForm() {
  const t = useTranslations("auth");
  const tRoles = useTranslations("roles");
  const router = useRouter();

  const [role, setRole] = useState<RegisterableRole | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!role) {
      setError(t("errors.roleRequired"));
      return;
    }

    setError(null);
    setPending(true);

    const { data, error: signUpError } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { role },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setPending(false);
      return;
    }

    // With email confirmation on, `session` is null and the user must click the
    // link. With it off, Supabase returns a session and we can go straight in.
    if (data.session) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setPending(false);
    setConfirmationSent(true);
  }

  if (confirmationSent) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{t("register.checkEmail")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("register.checkEmailBody", { email })}
        </p>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("register.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("register.chooseRole")}</p>
        </div>

        <div className="flex flex-col gap-2">
          {REGISTERABLE_ROLES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRole(option)}
              className="flex flex-col items-start gap-0.5 rounded-lg border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="text-sm font-medium">{tRoles(`${option}.name`)}</span>
              <span className="text-xs text-muted-foreground">
                {tRoles(`${option}.description`)}
              </span>
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">{t("register.chooseRoleHelp")}</p>

        <p className="text-sm text-muted-foreground">
          {t("register.haveAccount")}{" "}
          <Link href="/auth/login" className="text-primary underline-offset-4 hover:underline">
            {t("register.loginLink")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("register.title")}</h1>
        <p className="text-sm text-muted-foreground">{tRoles(`${role}.name`)}</p>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <p className="text-xs text-muted-foreground">{t("register.passwordHint")}</p>
        </div>

        <Button type="submit" size="lg" disabled={pending}>
          {t("register.submit")}
        </Button>
      </form>

      <Button type="button" variant="ghost" size="sm" onClick={() => setRole(null)}>
        {t("register.back")}
      </Button>
    </div>
  );
}
