"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const t = useTranslations("nav");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await createClient().auth.signOut();
      // Home, not /auth/login: signing out is not the start of signing back in,
      // and the homepage is the only page that works with no session.
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout} disabled={isPending}>
      {t("logout")}
    </Button>
  );
}
