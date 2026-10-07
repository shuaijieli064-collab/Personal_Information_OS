"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { api, tokens, ApiError } from "@/lib/api/client";
import { BlurReveal } from "@/components/motion/BlurReveal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function RegisterPage() {
  const t = useTranslations("Register");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError(t("errShort"));
    if (password !== confirm) return setError(t("errMismatch"));
    setLoading(true);
    try {
      const data = await api.post<{ accessToken: string; refreshToken: string }>(
        "/api/v1/auth/register",
        { email, password }
      );
      tokens.set(data.accessToken, data.refreshToken);
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("fallbackError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <BlurReveal className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-signal/10 text-signal ring-1 ring-signal/20">
            <span className="text-lg font-bold">S</span>
          </div>
          <p className="mt-4 text-xs uppercase tracking-[0.3em] text-text-3">SIGNAL</p>
        </div>

        <h1 className="text-center text-2xl font-semibold tracking-[-0.02em] text-text-1">
          {t("title")}
        </h1>
        <p className="mt-2 text-center text-sm text-text-2">{t("subtitle")}</p>

        <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-text-3">
              {t("email")}
            </span>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-text-3">
              {t("password")}
            </span>
            <Input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-text-3">
              {t("confirm")}
            </span>
            <Input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" loading={loading} className="mt-2 w-full">
            {loading ? t("submitting") : t("submit")}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-text-3">
          {t("hasAccount")}{" "}
          <Link href="/login" className="font-medium text-signal hover:underline">
            {t("signIn")}
          </Link>
        </p>
      </BlurReveal>
    </main>
  );
}
