"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SignOutButton from "../SignOutButton";

const input =
  "w-full rounded-md border border-border bg-bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent";

export default function LoginForm({ notAdmin }: { notAdmin: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-5">
      <h1 className="font-display text-5xl tracking-wide">Admin</h1>

      {notAdmin && (
        <p className="rounded-md border border-border p-3 text-sm text-fg-muted">
          You&apos;re signed in, but this account isn&apos;t an admin.{" "}
          <span className="inline-block align-baseline">
            <SignOutButton />
          </span>
        </p>
      )}

      <label className="block space-y-2">
        <span className="font-mono text-xs uppercase tracking-widest text-fg-muted">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={input}
        />
      </label>

      <label className="block space-y-2">
        <span className="font-mono text-xs uppercase tracking-widest text-fg-muted">Password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={input}
        />
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-accent px-6 py-3 font-mono text-xs font-medium uppercase tracking-widest text-[#0a0a0b] transition-opacity disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
