import { createFileRoute, Outlet, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/seefaa/app-shell";
import { useProfile } from "@/hooks/use-seefaa";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  const { data: profile, isLoading } = useProfile();
  const loc = useLocation();
  const navigate = useNavigate();
  const onOnboarding = loc.pathname.startsWith("/onboarding");
  useEffect(() => {
    if (profile && !profile.onboarded && !onOnboarding) navigate({ to: "/onboarding" });
  }, [profile, onOnboarding, navigate]);
  if (isLoading) return <div className="sky-bg grid min-h-screen place-items-center text-muted-foreground">Loading your study space…</div>;
  if (onOnboarding) return <Outlet />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
