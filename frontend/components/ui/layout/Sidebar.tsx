"use client";

import { useTranslations } from "next-intl";
import {
  Compass,
  GearSix,
  Graph,
  House,
  Sparkle,
  Tray,
} from "@phosphor-icons/react";
import { Link, usePathname } from "@/i18n/navigation";

const NAV = [
  { href: "/today", key: "today", icon: House },
  { href: "/inbox", key: "inbox", icon: Tray },
  { href: "/discover", key: "discover", icon: Compass },
  { href: "/knowledge", key: "knowledge", icon: Graph },
  { href: "/ai", key: "ai", icon: Sparkle },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop sidebar — the navigation spine of the app. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-bg-1 md:flex">
      <Link
        href="/today"
        onClick={onNavigate}
        className="flex h-16 items-center gap-2 border-b border-line px-5 text-xs uppercase tracking-[0.3em] text-text-1 transition-colors hover:text-signal"
      >
        SIGNAL
      </Link>

      <nav aria-label={t("label")} className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map(({ href, key, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-button px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-signal-dim text-signal"
                  : "text-text-2 hover:bg-bg-2 hover:text-text-1"
              }`}
            >
              <Icon size={18} weight={active ? "fill" : "regular"} />
              {t(key)}
            </Link>
          );
        })}

        <div className="mt-auto border-t border-line pt-3">
          <Link
            href="/settings/profile"
            onClick={onNavigate}
            aria-current={isActive(pathname, "/settings") ? "page" : undefined}
            className={`flex items-center gap-3 rounded-button px-3 py-2 text-sm transition-colors ${
              isActive(pathname, "/settings")
                ? "bg-signal-dim text-signal"
                : "text-text-2 hover:bg-bg-2 hover:text-text-1"
            }`}
          >
            <GearSix size={18} />
            {t("settings")}
          </Link>
        </div>
      </nav>
    </aside>
  );
}

/** Mobile bottom navigation — Today / Inbox / Discover / AI / Me. */
export function MobileNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  const items = [
    { href: "/today", key: "today", icon: House },
    { href: "/inbox", key: "inbox", icon: Tray },
    { href: "/discover", key: "discover", icon: Compass },
    { href: "/ai", key: "ai", icon: Sparkle },
    { href: "/settings/profile", key: "me", icon: GearSix },
  ];

  return (
    <nav
      aria-label={t("menuLabel")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-0/95 backdrop-blur-md md:hidden"
    >
      <div className="grid grid-cols-5">
        {items.map(({ href, key, icon: Icon }) => {
          const active = isActive(pathname, href) || (href === "/settings/profile" && isActive(pathname, "/settings"));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors ${
                active ? "text-signal" : "text-text-3 hover:text-text-2"
              }`}
            >
              <Icon size={20} weight={active ? "fill" : "regular"} />
              {t(key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
