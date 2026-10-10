import { pageMeta } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Award, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Empty } from "@/components/seefaa/bits";
import { useProfile, useXp } from "@/hooks/use-seefaa";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({ meta: pageMeta("Leaderboard — SEEFAA", "Opt-in XP leaderboard and your achievements.") }),
  component: Leaderboard,
});

const BADGES = [
  { id: "first_module", label: "First module", test: (s: Record<string, number>) => s.module_complete >= 1 },
  { id: "ten_modules", label: "Ten modules", test: (s: Record<string, number>) => s.module_complete >= 10 },
  { id: "first_rev", label: "First revision", test: (s: Record<string, number>) => s.revision_checkpoint >= 1 },
  { id: "fixer", label: "Mistake fixer ×10", test: (s: Record<string, number>) => s.mistake_corrected >= 10 },
  { id: "practice5", label: "5 practice sessions", test: (s: Record<string, number>) => s.practice_session >= 5 },
  { id: "mock1", label: "First mock", test: (s: Record<string, number>) => s.mock_exam >= 1 },
  { id: "xp500", label: "500 XP", test: (_: Record<string, number>, total: number) => total >= 500 },
];

function Leaderboard() {
  const [days, setDays] = useState(7);
  const { data: profile } = useProfile();
  const { data: xp } = useXp();
  const { data: board } = useQuery({
    queryKey: ["leaderboard", days],
    queryFn: async () => (await supabase.rpc("leaderboard", { _days: days })).data ?? [],
  });
  const counts = (xp?.rows ?? []).reduce<Record<string, number>>((a, r) => { a[r.source] = (a[r.source] ?? 0) + 1; return a; }, {});
  return (
    <div className="space-y-6">
      <PageHeader title="Leaderboard" subtitle="XP comes only from genuine learning, validated on the server." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Rankings" className="lg:col-span-2" action={<div className="flex gap-1">{[[7, "Week"], [30, "Month"], [0, "All time"]].map(([d, l]) => <Button key={d} size="sm" variant={days === d ? "default" : "ghost"} onClick={() => setDays(d as number)}>{l}</Button>)}</div>}>
          {!profile?.leaderboard_opt_in && <p className="mb-3 rounded-md bg-accent p-3 text-sm">You're not on the leaderboard. Only your display name and XP would be shown. <Link to="/settings" className="text-primary underline">Join in Settings</Link>.</p>}
          {!board?.length ? <Empty icon={<Trophy />} title="No one has joined yet" /> : (
            <ol className="space-y-1">{board.map((r, i) => (
              <li key={i} className={cn("flex items-center gap-3 rounded-lg px-3 py-2", r.is_me && "bg-sun/25 font-semibold")}>
                <span className="w-6 text-right text-sm text-muted-foreground">{i + 1}</span>
                <span className="flex-1">{r.display_name ?? "Candidate"}</span>
                <span className="font-display">{r.xp} XP</span>
              </li>
            ))}</ol>
          )}
        </Panel>
        <Panel title={`Your achievements · ${xp?.total ?? 0} XP`}>
          <div className="grid grid-cols-2 gap-2">
            {BADGES.map((b) => {
              const got = b.test(counts, xp?.total ?? 0);
              return (
                <div key={b.id} className={cn("rounded-xl border p-3 text-center text-xs", got ? "bg-sun/30 border-sun" : "opacity-50")}>
                  <Award className={cn("mx-auto mb-1 h-6 w-6", got ? "text-deep" : "text-muted-foreground")} />{b.label}
                </div>
              );
            })}
          </div>
          <div className="mt-4 max-h-56 space-y-1 overflow-y-auto text-xs">
            {(xp?.rows ?? []).slice(0, 30).map((r) => <div key={r.id} className="flex justify-between"><span>{r.source.replace(/_/g, " ")}</span><span>+{r.amount} · {new Date(r.created_at).toLocaleDateString()}</span></div>)}
          </div>
        </Panel>
      </div>
    </div>
  );
}
