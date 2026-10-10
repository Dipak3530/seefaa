import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className, action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn("card-soft p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-muted/40 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-primary">{icon}</div>}
      <p className="font-medium">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: string; tone?: "default" | "sun" | "deep" }) {
  return (
    <div className={cn("rounded-xl border p-4", tone === "sun" && "bg-sun/25 border-sun/50", tone === "deep" && "bg-deep text-deep-foreground border-deep", tone === "default" && "bg-card")}>
      <p className={cn("text-xs font-medium uppercase tracking-wide", tone === "deep" ? "opacity-80" : "text-muted-foreground")}>{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
      {hint && <p className={cn("mt-0.5 text-xs", tone === "deep" ? "opacity-80" : "text-muted-foreground")}>{hint}</p>}
    </div>
  );
}

export function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-seefaa space-y-3 text-sm leading-relaxed [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-deep [&_li]:ml-5 [&_ol]:list-decimal [&_table]:w-full [&_td]:border [&_td]:p-1.5 [&_th]:border [&_th]:bg-muted [&_th]:p-1.5 [&_ul]:list-disc [&_code]:rounded [&_code]:bg-muted [&_code]:px-1">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

export function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn("h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", props.className)}
    />
  );
}
