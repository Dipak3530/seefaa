import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, CalendarDays, RefreshCw, Sparkles, Trophy, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/seefaa/app-shell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SEEFAA — Your calm, complete CFA Level I study companion" },
      { name: "description", content: "Personal study plans with Ethics from day one, screenshot-first mistake logging, AI explanations and adaptive revision for CFA Level I." },
      { property: "og:title", content: "SEEFAA — CFA Level I, organized" },
      { property: "og:description", content: "SEEFAA remembers what you get wrong, explains why, and helps you revise it until you improve." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Camera, title: "Screenshot-first error log", body: "Paste a question you got wrong. AI reads it, you check it, and it joins your private mistake bank." },
  { icon: Sparkles, title: "Explain my mistake", body: "Step-by-step reasoning, calculator keystrokes, exam traps and a fresh practice question — saved for later." },
  { icon: CalendarDays, title: "A plan that fits you", body: "Pick your first subject and go. Ethics is woven in from day one, and the plan adapts to your real progress." },
  { icon: RefreshCw, title: "Adaptive revision", body: "R1–R5 checkpoints per module and spaced reviews of every mistake. Wrong answers come back sooner." },
  { icon: Trophy, title: "Progress you earned", body: "XP for genuine learning, streaks and an opt-in leaderboard — never for just clicking around." },
  { icon: Scale, title: "Private by default", body: "Your screenshots, notes and mistakes are visible only to you." },
];

function Landing() {
  return (
    <div className="sky-bg min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex gap-2">
          <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
          <Button asChild><Link to="/auth" search={{ mode: "signup" }}>Get started</Link></Button>
        </div>
      </header>
      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-12 text-center md:pt-24">
        <div aria-hidden className="cloud-drift pointer-events-none absolute left-1/2 top-6 h-40 w-[36rem] -translate-x-1/2 rounded-full bg-card/60 blur-3xl" />
        <p className="relative mx-auto mb-5 inline-flex rounded-full border bg-card/70 px-4 py-1 text-xs font-medium text-deep">CFA Level I · 2027 curriculum</p>
        <h1 className="relative mx-auto max-w-3xl text-4xl font-bold leading-tight text-foreground md:text-6xl">
          Every mistake, remembered.<br /><span className="text-primary">Every concept, revised.</span>
        </h1>
        <p className="relative mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          SEEFAA organizes your CFA journey, remembers what you get wrong, explains why — and brings it back until you’ve got it.
        </p>
        <div className="relative mt-8 flex justify-center gap-3">
          <Button asChild size="lg" className="h-12 px-6 text-base"><Link to="/auth" search={{ mode: "signup" }}>Start your plan — free</Link></Button>
          <Button asChild size="lg" variant="outline" className="h-12 bg-card/70 px-6 text-base"><Link to="/auth">I have an account</Link></Button>
        </div>
        <div className="relative mx-auto mt-16 h-1 w-48 rounded-full bg-sun-gradient" />
      </section>
      <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="card-soft p-6">
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>
      <footer className="border-t bg-card/60 py-6 text-center text-xs text-muted-foreground">
        SEEFAA is an independent study tool and is not affiliated with or endorsed by CFA Institute.
      </footer>
    </div>
  );
}
