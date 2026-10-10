import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/seefaa/app-shell";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — SEEFAA" },
      { name: "description", content: "Choose a new password for your SEEFAA account." },
      { property: "og:title", content: "Set a new password — SEEFAA" },
      { property: "og:description", content: "Choose a new password for your SEEFAA account." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const navigate = useNavigate();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  }
  return (
    <div className="sky-bg flex min-h-screen items-center justify-center px-4">
      <form onSubmit={save} className="card-soft w-full max-w-md space-y-4 p-8">
        <Logo />
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        <Input type="password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" required />
        <Button className="w-full">Save password</Button>
      </form>
    </div>
  );
}
