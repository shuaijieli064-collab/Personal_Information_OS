"use client";

import { useTranslations } from "next-intl";
import {
  ClockCountdown,
  Compass,
  GearSix,
  Graph,
  House,
  SignOut,
  Sparkle,
  Tray,
} from "@phosphor-icons/react";
import { Link, usePathname } from "@/i18n/navigation";
import { useUiStore } from "@/lib/stores/ui";
import { BrandMark } from "@/components/layout/BrandMark";

type NavItem = { href: string; key: string; icon: typeof House };

/** Primary navigation, grouped by intent rather than alphabetically. */
const GROUPS: { key: string; items: NavItem[] }[] = [
  {
    key: "groupWorkspace",
    items: [
      { href: "/today", key: "today", icon: House },
      { href: "/inbox", key: "inbox", icon: Tray },
      { href: "/discover", key: "discover", icon: Compass },
    ],
  },
  {
    key: "groupInsight",
    items: [
      { href: "/knowledge", key: "knowledge", icon: Graph },
      { href: "/ai", key: "ai", icon: Sparkle },
      { href: "/automation", key: "automation", icon: ClockCountdown },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The shared link shape — also used by MobileNav so both feel identical. */
export function RailLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed = false,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof House;
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={`rail-link ${collapsed ? "h-10 w-10 justify-center px-0" : "px-3 py-2"}`}
    >
      {/* Active indicator: a 2px signal rail, not a colour wash. */}
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-pill bg-signal transition-transform duration-200 ${
          active ? "scale-y-100" : "scale-y-0"
        }`}
      />
      <Icon size={18} weight={active ? "fill" : "regular"} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
      {collapsed && <span className="sr-only">{label}</span>}
    </Link>
  );
}

/** Desktop navigation rail — collapses to an icon rail, never disappears. */
export function Sidebar() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.railCollapsed);

  return (
    <aside
      aria-label={t("label")}
      className={`sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-line bg-bg-0/60 backdrop-blur-xl transition-[width] duration-300 md:flex ${
        collapsed ? "w-[76px]" : "w-[268px]"
      }`}
    >
      {/* Brand block */}
      <div
        className={`flex h-[60px] shrink-0 items-center gap-2.5 border-b border-line ${
          collapsed ? "justify-center px-0" : "px-5"
        }`}
      >
        <Link
          href="/today"
          className="flex items-center gap-2.5 focus-ring rounded-button"
        >
          <BrandMark size={22} />
          {!collapsed && (
            <>
              <span className="font-display text-[13px] font-bold uppercase tracking-[0.28em] text-text-1">
                SIGNAL
              </span>
              <span className="relative ml-auto flex h-1.5 w-1.5" aria-hidden="true">
                <span className="absolute inset-0 rounded-full bg-success animate-signal-pulse" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-success" />
              </span>
            </>
          )}
          <span className="sr-only">{t("live")}</span>
        </Link>
      </div>

      {/* Navigation groups */}
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto p-3">
        {GROUPS.map(({ key, items }) => (
          <div key={key}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-3">
                {t(key)}
              </p>
            )}
            {collapsed && (
              <span aria-hidden="true" className="mb-2 block h-px bg-line" />
            )}
            <div className="flex flex-col gap-0.5">
              {items.map(({ href, key: itemKey, icon }) => (
                <RailLink
                  key={href}
                  href={href}
                  label={t(itemKey)}
                  icon={icon}
                  active={isActive(pathname, href)}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="mt-auto">
          <RailLink
            href="/settings/profile"
            label={t("settings")}
            icon={GearSix}
            active={isActive(pathname, "/settings")}
            collapsed={collapsed}
          />
        </div>
      </nav>

      {/* Footer: sign-out affordance. Left as a link to security settings
          because destroying a session is a two-step on purpose. */}
      {!collapsed && (
        <div className="shrink-0 border-t border-line p-3">
          <Link
            href="/settings/security"
            className="rail-link px-3 py-2 text-text-3 hover:text-danger"
          >
            <SignOut size={18} className="shrink-0" />
            <span className="truncate">{t("signOut")}</span>
          </Link>
        </div>
      )}
    </aside>
  );
}

/** Mobile bottom navigation — five primary destinations, thumb-reachable. */
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-0/85 backdrop-blur-xl md:hidden"
    >
      <div className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ href, key, icon: Icon }) => {
          const active =
            isActive(pathname, href) ||
            (href === "/settings/profile" && isActive(pathname, "/settings"));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                active ? "text-signal" : "text-text-3 hover:text-text-2"
              }`}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-4 top-0 h-0.5 rounded-pill bg-signal"
                />
              )}
              <Icon size={20} weight={active ? "fill" : "regular"} />
              {t(key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
