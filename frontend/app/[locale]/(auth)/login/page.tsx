"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { api, tokens, ApiError } from "@/lib/api/client";
import { Warning } from "@phosphor-icons/react";
import { BlurReveal } from "@/components/motion/BlurReveal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  const t = useTranslations("Login");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.post<{ accessToken: string; refreshToken: string }>(
        "/api/v1/auth/login",
        { email, password }
      );
      tokens.set(data.accessToken, data.refreshToken);
      router.push("/today");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("fallbackError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center">
      <BlurReveal className="w-full rounded-shell border border-line-strong bg-bg-2/70 p-9 shadow-float backdrop-blur-xl">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-signal/10 text-signal ring-1 ring-signal/20 lg:hidden">
            <span className="text-lg font-bold">S</span>
          </div>
          <p className="mt-4 text-xs uppercase tracking-[0.3em] text-text-3 lg:mt-0">
            SIGNAL
          </p>
        </div>

        <h1 className="text-center font-display text-2xl font-semibold tracking-[-0.02em] text-text-1">
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
              autoComplete="email"
              placeholder="you@example.com"
              className="bg-bg-0"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-text-3">
              {t("password")}
            </span>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              className="bg-bg-0"
            />
          </label>
          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-control border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger"
            >
              <Warning size={15} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}
          <Button type="submit" loading={loading} className="mt-2 w-full">
            {loading ? t("submitting") : t("submit")}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-text-3">
          {t("noAccount")}{" "}
          <Link href="/register" className="font-medium text-signal hover:underline">
            {t("createAccount")}
          </Link>
        </p>
      </BlurReveal>
    </main>
  );
}
