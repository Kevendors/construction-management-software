"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, HardHat, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [ready, setReady] = React.useState(false);
  const [validLink, setValidLink] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  // The recovery email link lands here with a `code` (PKCE) which we exchange
  // for a short-lived session, or an existing PASSWORD_RECOVERY session.
  React.useEffect(() => {
    let active = true;
    async function init() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (active) {
          setValidLink(!exErr);
          if (exErr) setError("This reset link is invalid or has expired. Request a new one.");
          setReady(true);
        }
        return;
      }
      // fall back to any active session (e.g. PASSWORD_RECOVERY already set)
      const { data } = await supabase.auth.getSession();
      if (active) {
        setValidLink(!!data.session);
        if (!data.session) setError("This page must be opened from a password-reset email link.");
        setReady(true);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setLoading(true);
    try {
      const { error: upErr } = await supabase.auth.updateUser({ password });
      if (upErr) setError(upErr.message);
      else setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-7 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HardHat className="h-6 w-6" />
          </span>
          <h1 className="text-xl font-bold tracking-tight">SiteHub</h1>
          <p className="mt-1 text-sm text-muted-foreground">Set a new password</p>
        </div>

        {!ready ? (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verifying link…
          </p>
        ) : done ? (
          <div className="space-y-4 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <p className="text-sm text-muted-foreground">Your password has been updated.</p>
            <Button className="w-full" onClick={() => router.push("/")}>
              Continue to app
            </Button>
          </div>
        ) : validLink ? (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Input id="new-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" autoFocus required className="pr-10" />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input id="confirm-password" type={showPassword ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" required />
            </div>
            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Update password
            </Button>
          </form>
        ) : (
          <div className="space-y-4 text-center">
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            <Button variant="outline" className="w-full" onClick={() => router.push("/login")}>
              Back to sign in
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
