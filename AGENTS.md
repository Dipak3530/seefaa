<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Render saved question text through the shared question surface and conservative Markdown table normalizer across detail, bank and retry views; preserve stored source text and all answer logic.
- Keep source-attributed cheat-sheet equations in a browser-safe reference catalog separate from user-owned formulas; saving a reference uses the existing notebook form and never seeds user data on page load.
- Keep Vite's `optimizeDeps.ignoreOutdatedRequests` false so dependency updates cannot serve React under stale and current URLs with separate hook dispatchers.
- Shared visual tokens live in `src/styles.css`, reusable learning surfaces in `bits.tsx`, and authenticated navigation in `app-shell.tsx`; redesigns change presentation without replacing data hooks or database workflows.
- Tactile button treatments and loading states live in shared Button variants and semantic CSS tokens; supporting action colors remain tokenized so all actions inherit consistent outline, texture and press states without altering workflows.
- Content routes use the browser-safe `pageMeta` helper for consistent page-specific social metadata without importing server modules.
- XP is awarded only by database triggers into `xp_ledger` with a unique `source_key`; clients cannot insert XP (prevents duplicate/forged awards).
- Timer pause/resume/finish goes through the `timer_action` SQL function so durations use server timestamps; one open timer per user enforced by a partial unique index.
- Plan generation is a pure function in `src/lib/planner.ts` (tested); applying a plan only replaces future undone tasks.
- AI calls live in `src/lib/ai.functions.ts` (server-only via createServerFn, per-user daily quota via `ai_usage`); explanations are stored in `ai_explanations` to avoid repeat calls. Files under `src/server/` cannot be imported by routes — the build treats them as server-only, so server functions must live elsewhere.
- Curriculum is versioned (`curriculum_versions` → subjects → modules → los); progress rows reference an exam attempt so attempts never overwrite each other.
- Study Portal lesson text lives in a private storage bucket as one JSON file per subject (extracted from the uploaded 2027 PDFs), while LOS rows live in the los table; keeps 9MB of copyrighted text out of the bundle and behind sign-in.
