import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, ChartNoAxesCombined, Check, CheckCircle2, Clock3, Flame, Layers3, RefreshCw, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/seefaa/app-shell";
import { Bar } from "@/components/seefaa/bits";
import doodles from "@/assets/study-doodles.png";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "SEEFAA — Master the CFA. One concept at a time." },
    { name: "description", content: "Your CFA Level I journey, smarter: personalized planning, curriculum tracking, smart revision and private mistake analysis with SEEFAA." },
    { property: "og:title", content: "SEEFAA — Your CFA journey, smarter" },
    { property: "og:description", content: "A thoughtful study companion for CFA Level I. Plan with purpose, learn from mistakes, and build lasting confidence." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Landing,
});

const FEATURES = [
  { icon: ChartNoAxesCombined, title: "Track Your Progress", body: "Every subject. Every concept. A clearer view of how far you've come." },
  { icon: RefreshCw, title: "Smart Revision", body: "Revisit the right concepts, at the right time. Make learning stick." },
  { icon: Layers3, title: "Learn From Mistakes", body: "Turn wrong answers into your most valuable study material." },
  { icon: Flame, title: "Stay Consistent", body: "Small daily wins. A plan that fits. Momentum that lasts." },
];

function StudyPreview() {
  return <div className="study-composition" aria-label="Illustrative SEEFAA study preview">
    <div className="preview-main editorial-shadow rounded-lg border border-foreground bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between border-b pb-3"><span className="font-display text-sm font-bold">Your learning, in focus.</span><Sparkles className="h-4 w-4 text-primary" /></div>
      <div className="mt-4 flex items-center gap-5">
        <div className="relative h-24 w-24 shrink-0"><svg viewBox="0 0 100 100" className="preview-ring h-full w-full" aria-hidden><circle className="ring-track" cx="50" cy="50" r="40" /><circle className="ring-progress" cx="50" cy="50" r="40" strokeDasharray="181 251" /></svg><span className="absolute inset-0 grid place-items-center font-display text-2xl font-bold">72<span className="absolute bottom-4 text-[10px] font-medium text-muted-foreground">% complete</span></span></div>
        <div><p className="text-[10px] font-bold uppercase text-primary">CFA Level I</p><p className="mt-1 font-display text-lg font-bold">A little better,<br />every day.</p><p className="mt-1 text-xs text-muted-foreground">Keep your momentum going.</p></div>
      </div>
      <div className="mt-5 space-y-3">
        <div><div className="mb-1 flex justify-between text-xs"><span>Quantitative Methods</span><span className="font-bold text-primary">84%</span></div><Bar value={84} /></div>
        <div><div className="mb-1 flex justify-between text-xs"><span>Ethical & Professional Standards</span><span className="font-bold text-primary">62%</span></div><Bar value={62} /></div>
      </div>
      <div className="mt-5 flex items-center gap-2 border-t pt-3 text-xs"><CheckCircle2 className="h-4 w-4 text-primary" /><span>One concept closer to exam day.</span></div>
    </div>
    <div className="preview-timer card-soft border-foreground p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-4 w-4 text-primary" /> Focus time</div>
      <p className="my-2 font-display text-3xl font-bold tabular-nums">25:00<span className="ml-2 inline-block h-2 w-2 rounded-full bg-primary" /></p>
      <p className="text-xs font-medium">Just you and the next concept.</p>
    </div>
    <div className="preview-formula card-soft border-foreground p-4">
      <span className="text-[10px] font-bold uppercase text-primary">The formula notebook</span>
      <p className="my-3 font-display text-xl font-semibold">FV = PV (1 + r)ⁿ</p>
      <p className="text-xs text-muted-foreground">Big ideas. Made simple.</p>
    </div>
    <div className="preview-revision card-soft border-foreground p-4">
      <div className="flex items-center gap-2 text-sm font-bold"><RefreshCw className="h-4 w-4 text-primary" /> Make it stick.</div>
      <div className="my-3 flex justify-between">{[1, 2, 3, 4, 5].map(n => <span key={n} className={`grid h-7 w-7 place-items-center rounded-md text-xs font-bold ${n < 4 ? "bg-primary text-primary-foreground" : "border bg-background text-muted-foreground"}`}>{n < 4 ? <Check className="h-3 w-3" /> : `R${n}`}</span>)}</div>
      <p className="text-xs text-muted-foreground">Learn. Revisit. Remember.</p>
    </div>
  </div>;
}

function Landing() {
  return <div className="comic-canvas min-h-screen overflow-hidden bg-background">
    <header className="relative z-20 mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-6 sm:flex sm:justify-between lg:px-8">
      <Logo />
      <nav aria-label="Main navigation" className="comic-nav hidden items-center gap-2 rounded-lg bg-card px-5 lg:flex">
        <Link to="/" className="border-b-2 border-primary px-3 py-4 text-sm font-semibold text-primary">Home</Link>
        <Link to="/curriculum" className="px-3 py-4 text-sm font-semibold hover:text-primary">Curriculum</Link>
        <Link to="/plan" className="px-3 py-4 text-sm font-semibold hover:text-primary">Study Planner</Link>
        <Link to="/mistakes" className="px-3 py-4 text-sm font-semibold hover:text-primary">Mistake Bank</Link>
      </nav>
      <div className="flex shrink-0 gap-2"><Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button><Button asChild className="h-10"><Link to="/auth" search={{ mode: "signup" }}>Get started <ArrowRight /></Link></Button></div>
    </header>
    <div className="relative">
      <img src={doodles} width={1536} height={1024} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35" />
      <section className="landing-hero relative mx-auto grid max-w-7xl items-center gap-10 px-6 pb-14 pt-10 lg:grid-cols-2 lg:gap-12 lg:px-12 lg:pt-8">
        <div className="relative z-10 max-w-xl">
          <p className="mb-5 flex items-center gap-2 text-sm font-bold"><span className="h-2 w-2 rounded-full bg-primary" />Your CFA Journey, Smarter.</p>
          <h1 className="text-4xl font-extrabold leading-[1.15] sm:text-5xl lg:text-[58px]">Master the CFA.<br /><span className="text-primary">One concept</span><br />at a time.</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">A big goal deserves a thoughtful plan. Personalized planning, structured curriculum tracking, smart revision, and mistake analysis — all in your corner.</p>
          <div className="mt-7 flex flex-col gap-4 sm:flex-row"><Button asChild size="lg" className="h-12 px-6"><Link to="/dashboard">Start Studying <ArrowRight /></Link></Button><Button asChild variant="secondary" size="lg" className="h-12 px-4"><Link to="/curriculum">Explore the Curriculum <BookOpen /></Link></Button></div>
          <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" /> Built for CFA Level I. Designed for real life.</p>
        </div>
        <StudyPreview />
      </section>
      <section aria-label="Study benefits" className="relative mx-auto grid max-w-7xl gap-4 px-6 pb-16 sm:grid-cols-2 lg:grid-cols-4 lg:px-12">
        {FEATURES.map(f => <article key={f.title} className="landing-feature flex items-start gap-3 rounded-lg border bg-card p-5"><f.icon className="mt-1 h-6 w-6 shrink-0 text-primary" /><div className="min-w-0"><h2 className="text-sm font-bold">{f.title}</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">{f.body}</p></div></article>)}
      </section>
    </div>
    <section className="border-y bg-card/50">
      <div className="mx-auto grid max-w-7xl items-start gap-8 px-6 py-14 lg:grid-cols-[1fr_1.2fr] lg:px-12">
        <div><p className="mb-3 text-xs font-bold uppercase text-primary">Less overwhelm. More understanding.</p><h2 className="text-3xl font-bold leading-tight">Your goal is ambitious.<br />Your study day can be simple.</h2><p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">Follow a personal plan, track all ten subjects, and give every difficult concept another chance. Ethics is part of the journey from day one.</p><Button asChild variant="link" className="mt-3 px-0"><Link to="/auth" search={{ mode: "signup" }}>Make your next study session count <ArrowRight /></Link></Button></div>
        <div className="grid gap-6 sm:grid-cols-3">{[{ icon: Target, n: "01", title: "Find your focus", body: "A study plan shaped around your exam date, pace, and priorities." }, { icon: BookOpen, n: "02", title: "Build understanding", body: "Keep your curriculum, notes, formulas, and mistakes connected." }, { icon: RefreshCw, n: "03", title: "Keep it with you", body: "Spaced revision turns today's effort into exam-day confidence." }].map(s => <div key={s.n} className="border-t-2 border-foreground pt-4"><div className="mb-5 flex items-center justify-between"><span className="font-display text-2xl font-bold text-primary">{s.n}</span><s.icon className="h-5 w-5" /></div><h3 className="text-sm font-bold">{s.title}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{s.body}</p></div>)}</div>
      </div>
    </section>
    <footer className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-5 px-6 py-8 sm:flex-row sm:items-center lg:px-12"><Logo /><p className="max-w-lg text-xs leading-5 text-muted-foreground">SEEFAA is an independent study tool and is not affiliated with or endorsed by CFA Institute.</p><span className="text-xs font-semibold text-primary">A little progress, every day.</span></footer>
  </div>;
}
