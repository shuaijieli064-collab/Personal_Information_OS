"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { api, tokens, ApiError } from "@/lib/api/client";
import { BlurReveal } from "@/components/motion/BlurReveal";

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
      <BlurReveal className="w-full max-w-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-text-3">SIGNAL</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.02em]">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-text-2">{t("subtitle")}</p>

        <form onSubmit={submit} className="mt-10 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wider text-text-3">
              {t("email")}
            </span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-line bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-signal" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wider text-text-3">
              {t("password")}
            </span>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-line bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-signal" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wider text-text-3">
              {t("confirm")}
            </span>
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="rounded-md border border-line bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-signal" />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={loading}
            className="mt-2 rounded-md bg-signal px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {loading ? t("submitting") : t("submit")}
          </button>
        </form>

        <p className="mt-8 text-sm text-text-3">
          {t("hasAccount")}{" "}
          <Link href="/login" className="text-signal">
            {t("signIn")}
          </Link>
        </p>
      </BlurReveal>
    </main>
  );
}
