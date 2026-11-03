"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { api, tokens } from "@/lib/api/client";
import { authErrorMessage } from "@/lib/api/authError";
import { Warning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthCard } from "@/components/ui/auth/AuthCard";

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
      setError(authErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <>
          {t("hasAccount")}{" "}
          <Link href="/login" className="font-medium text-signal hover:underline">
            {t("signIn")}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
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
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-bg-0"
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
          <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
            {loading ? t("submitting") : t("submit")}
          </Button>
        </form>
    </AuthCard>
  );
}
