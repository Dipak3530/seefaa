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
- XP is awarded only by database triggers into `xp_ledger` with a unique `source_key`; clients cannot insert XP (prevents duplicate/forged awards).
- Timer pause/resume/finish goes through the `timer_action` SQL function so durations use server timestamps; one open timer per user enforced by a partial unique index.
- Plan generation is a pure function in `src/lib/planner.ts` (tested); applying a plan only replaces future undone tasks.
- AI calls live in `src/server/ai.functions.ts` (server-only, per-user daily quota via `ai_usage`); explanations are stored in `ai_explanations` to avoid repeat calls.
- Curriculum is versioned (`curriculum_versions` → subjects → modules → los); progress rows reference an exam attempt so attempts never overwrite each other.
