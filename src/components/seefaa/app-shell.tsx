import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  LayoutDashboard, CalendarDays, BookOpen, Camera, Library, RefreshCw, Target, ClipboardCheck,
  Sigma, BarChart3, Trophy, Settings, LogOut, Menu, Cloud,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { TimerPanel } from "./timer";
import { useXp } from "@/hooks/use-seefaa";

export const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/plan", label: "My Study Plan", icon: CalendarDays },
  { to: "/curriculum", label: "CFA Curriculum", icon: BookOpen },
  { to: "/error-log", label: "Error Log", icon: Camera },
  { to: "/mistakes", label: "My Mistake Bank", icon: Library },
  { to: "/revision", label: "Revision Centre", icon: RefreshCw },
  { to: "/practice", label: "Practice Sessions", icon: Target },
  { to: "/mocks", label: "Mock Exams", icon: ClipboardCheck },
  { to: "/formulas", label: "Formula Notebook", icon: Sigma },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/settings", label: "Profile & Settings", icon: Settings },
] as const;

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground"><Cloud className="h-4 w-4" /></span>
      <span className="font-display text-lg font-bold tracking-tight text-deep">SEEFAA</span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "bg-sidebar-accent text-deep font-semibold" }}
        >
          <n.icon className="h-4 w-4" /> {n.label}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: xp } = useXp();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  const side = (
    <div className="flex h-full flex-col gap-6 p-4">
      <Logo />
      <NavList onNavigate={() => setOpen(false)} />
      <div className="mt-auto space-y-2">
        <div className="rounded-xl bg-sun/30 px-3 py-2 text-sm"><span className="font-semibold">{xp?.total ?? 0} XP</span> earned</div>
        <Button variant="ghost" className="w-full justify-start" onClick={signOut}><LogOut className="mr-2 h-4 w-4" /> Sign out</Button>
      </div>
    </div>
  );
  return (
    <div className="sky-bg min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-sidebar backdrop-blur md:block">{side}</aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card/80 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild><Button size="icon" variant="ghost" aria-label="Open menu"><Menu /></Button></SheetTrigger>
          <SheetContent side="left" className="w-72 p-0"><SheetTitle className="sr-only">Navigation</SheetTitle>{side}</SheetContent>
        </Sheet>
      </header>
      <main className="px-4 pb-28 pt-6 md:ml-64 md:px-8 md:pb-12">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-card/95 backdrop-blur md:hidden">
        {[NAV[0], NAV[3], NAV[5], NAV[1]].map((n) => (
          <Link key={n.to} to={n.to} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground" activeProps={{ className: "text-deep font-semibold" }}>
            <n.icon className="h-5 w-5" /> {n.label.replace("My ", "").replace(" Centre", "")}
          </Link>
        ))}
      </nav>
      <TimerPanel />
    </div>
  );
}
