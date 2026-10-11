import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { LayoutDashboard, CalendarDays, BookOpen, Camera, Library, RefreshCw, Target, ClipboardCheck, Sigma, BarChart3, Trophy, Settings, LogOut, Menu, Bell, ChevronDown, ArrowUpRight, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { TimerPanel } from "./timer";
import { useXp, useProfile } from "@/hooks/use-seefaa";

export const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/plan", label: "Study Planner", icon: CalendarDays },
  { to: "/curriculum", label: "Curriculum", icon: BookOpen },
  { to: "/error-log", label: "Log a Mistake", icon: Camera },
  { to: "/mistakes", label: "Mistake Bank", icon: Library },
  { to: "/revision", label: "Revision Centre", icon: RefreshCw },
  { to: "/practice", label: "Practice", icon: Target },
  { to: "/mocks", label: "Mock Exams", icon: ClipboardCheck },
  { to: "/formulas", label: "Formula Notebook", icon: Sigma },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/leaderboard", label: "Achievements", icon: Trophy },
  { to: "/settings", label: "Profile & Settings", icon: Settings },
] as const;
const PRIMARY_NAV = [NAV[0], NAV[2], NAV[3], NAV[1], NAV[5], NAV[7], NAV[10]];
const SECONDARY_NAV = [NAV[4], NAV[6], NAV[8], NAV[9], NAV[11]];

export function Logo() {
  return <Link to="/" aria-label="SEEFAA home" className="flex shrink-0 items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-foreground bg-primary text-primary-foreground sm:h-9 sm:w-9"><BookOpen className="h-5 w-5" strokeWidth={2.5} /></span><span className="font-display text-xl font-extrabold text-foreground sm:text-2xl">SEEFAA<span className="text-primary">.</span></span></Link>;
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return <nav aria-label="All study pages" className="flex flex-col gap-1">{NAV.map(n => <Link key={n.to} to={n.to} onClick={onNavigate} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" activeProps={{ className: "bg-accent text-primary font-bold" }}><n.icon className="h-4 w-4 shrink-0" />{n.label}</Link>)}</nav>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: xp } = useXp();
  const { data: profile } = useProfile();
  async function signOut() {
    await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true });
  }
  const side = <div className="flex h-full flex-col gap-6 overflow-y-auto p-5"><Logo /><NavList onNavigate={() => setOpen(false)} /><div className="mt-auto space-y-2 border-t pt-4"><div className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm"><Trophy className="h-4 w-4 text-primary" /><span className="font-bold">{xp?.total ?? 0} XP</span> earned</div><Button variant="ghost" className="w-full justify-start" onClick={signOut}><LogOut /> Sign out</Button></div></div>;
  return <div className="comic-canvas min-h-screen bg-background">
    <header className="sticky top-0 z-30 border-b bg-background px-4 pt-3 sm:px-6 lg:px-8">
      <div className="comic-nav mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg bg-card px-4 lg:flex lg:justify-between">
        <div className="min-w-0 py-3"><Logo /></div>
        <nav aria-label="Primary navigation" className="app-navigation hidden min-w-0 items-center xl:flex">{PRIMARY_NAV.map(n => <Link key={n.to} to={n.to} className="relative whitespace-nowrap px-3 py-6 text-xs font-semibold text-muted-foreground hover:text-primary">{n.label}</Link>)}</nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Notifications" title="Notifications"><Bell className="h-5 w-5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-64 p-3"><p className="mb-2 text-sm font-bold">Your study reminders</p><p className="text-xs leading-5 text-muted-foreground">Your due revision checkpoints and mistake reviews are in the Revision Centre.</p><DropdownMenuItem asChild className="mt-2"><Link to="/revision"><RefreshCw /> View due reviews <ArrowUpRight /></Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/settings"><Settings /> Reminder preferences</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" aria-label="Profile menu" className="h-10 gap-2 px-1.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-primary">{profile?.display_name?.charAt(0).toUpperCase() || "S"}</span><ChevronDown className="hidden sm:block" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><p className="px-2 py-2 text-xs font-bold">{profile?.display_name || "Your account"} · {xp?.total ?? 0} XP</p><DropdownMenuItem asChild><Link to="/settings"><Settings /> Profile & Settings</Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/leaderboard"><Trophy /> Achievements</Link></DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={signOut}><LogOut /> Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          <Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button size="icon" variant="ghost" aria-label="Open menu" className="xl:hidden"><Menu /></Button></SheetTrigger><SheetContent side="left" className="w-72 p-0"><SheetTitle className="sr-only">Navigation</SheetTitle>{side}</SheetContent></Sheet>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 py-2.5">
        <p className="hidden shrink-0 text-[10px] font-bold uppercase text-muted-foreground sm:block">Your CFA journey, smarter.</p>
        <nav aria-label="Study tools" className="flex min-w-0 items-center gap-2 overflow-x-auto sm:gap-4">{SECONDARY_NAV.map(n => <Link key={n.to} to={n.to} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap py-1 text-[11px] font-semibold text-muted-foreground hover:text-primary" activeProps={{ className: "text-primary" }}><n.icon className="h-3.5 w-3.5" />{n.label}</Link>)}</nav>
        <span className="hidden shrink-0 items-center gap-1.5 text-xs font-bold text-primary lg:flex"><Trophy className="h-3.5 w-3.5" />{xp?.total ?? 0} XP</span>
      </div>
    </header>
    <main className="px-4 pb-32 pt-7 sm:px-6 lg:px-8 lg:pt-9"><div className="mx-auto max-w-[1360px]">{children}</div></main>
    <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-card xl:hidden">{[NAV[0], NAV[3], NAV[1], NAV[5]].map(n => <Link key={n.to} to={n.to} className="flex flex-col items-center gap-1 py-3 text-[10px] font-semibold text-muted-foreground" activeProps={{ className: "text-primary bg-accent/30" }}><n.icon className="h-4 w-4" />{n.label}</Link>)}</nav>
    <TimerPanel />
  </div>;
}
