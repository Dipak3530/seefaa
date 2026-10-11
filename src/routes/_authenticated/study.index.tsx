import { createFileRoute, redirect } from "@tanstack/react-router";

// Merged into the Curriculum hub — keep the old URL working.
export const Route = createFileRoute("/_authenticated/study/")({
  beforeLoad: () => {
    throw redirect({ to: "/curriculum" });
  },
});
