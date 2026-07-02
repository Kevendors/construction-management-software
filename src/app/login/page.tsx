"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, HardHat, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "forgot";

/** Phone → login-alias email; real emails pass through unchanged. */
function resolveEmail(identifier: string): string {
  const id = identifier.trim();
  if (id.includes("@")) return id;
  return `${id.replace(/\D/g, "")}@sitehub.phone`;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("signin");
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setSent(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();

      if (mode === "forgot") {
        const id = identifier.trim();
        if (!id.includes("@")) {
          setError("Password reset needs an email. For phone-only accounts, ask your admin to reset it.");
          return;
        }
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(id, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetErr) setError(resetErr.message);
        else setSent(true);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: resolveEmail(identifier),
        password,
      });
      if (signInError) {
        setError("Incorrect phone/email or password.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const title = mode === "signin" ? "Sign in to your workspace" : "Reset your password";

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-7 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HardHat className="h-6 w-6" />
          </span>
          <h1 className="text-xl font-bold tracking-tight">SiteHub</h1>
          <p className="mt-1 text-sm text-muted-foreground">{title}</p>
        </div>

        {mode === "forgot" && sent ? (
          <div className="space-y-4 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
              <MailCheck className="h-6 w-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              If an account exists for <span className="font-medium text-foreground">{identifier}</span>, we&apos;ve
              sent a password-reset link. Check your inbox (and spam).
            </p>
            <Button variant="outline" className="w-full" onClick={() => switchMode("signin")}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="identifier">{mode === "forgot" ? "Email" : "Phone number or email"}</Label>
              <Input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={mode === "forgot" ? "you@company.com" : "9XXXXXXXXX or you@company.com"}
                autoComplete="username"
                required
                autoFocus
              />
            </div>

            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="pr-10"
                  />
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
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Send reset link"}
            </Button>
          </form>
        )}

        {mode === "forgot" && !sent && (
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <button type="button" onClick={() => switchMode("signin")} className="font-medium text-primary hover:underline">
              Sign in
            </button>
          </p>
        )}
        {mode === "signin" && (
          <p className="mt-5 text-center text-xs text-muted-foreground">
            Accounts are created by your administrator.
          </p>
        )}
      </div>
    </div>
  );
}
