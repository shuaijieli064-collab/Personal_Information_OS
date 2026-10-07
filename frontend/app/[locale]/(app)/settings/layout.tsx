"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LockKey, User } from "@phosphor-icons/react";
import { Link, usePathname } from "@/i18n/navigation";

const ITEMS = [
  { href: "/settings/profile", icon: User, group: "Profile", titleKey: "title" },
  { href: "/settings/security", icon: LockKey, group: "Security", titleKey: "title" },
] as const;

/** Two-column settings shell: icon rail + content area. */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  const tNav = useTranslations("Nav");
  const pathname = usePathname();
  const tProfile = useTranslations("Profile");
  const tSecurity = useTranslations("Security");
  const labels = { Profile: tProfile("title"), Security: tSecurity("title") };

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-6 py-8 md:grid-cols-[208px_1fr] md:gap-10 md:py-10">
      <aside>
        <p className="text-meta uppercase tracking-[0.18em] text-text-3">
          {tNav("settings")}
        </p>
        <nav
          aria-label={tNav("settings")}
          className="mt-3 flex gap-1 overflow-x-auto md:flex-col"
        >
          {ITEMS.map(({ href, icon: Icon, group }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-button px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-signal-dim text-signal animate-signal-pulse"
                    : "text-text-2 hover:bg-bg-2 hover:text-text-1"
                }`}
              >
                <Icon size={17} weight={active ? "fill" : "regular"} />
                {labels[group]}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
