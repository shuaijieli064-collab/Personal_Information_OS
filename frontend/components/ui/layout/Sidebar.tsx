"use client";

import { useTranslations } from "next-intl";
import {
  ClockCountdown,
  Compass,
  GearSix,
  Graph,
  House,
  Rss,
  SignOut,
  Sparkle,
  Tray,
} from "@phosphor-icons/react";
import { Link, usePathname } from "@/i18n/navigation";
import { BrandMark } from "@/components/layout/BrandMark";

type NavItem = { href: string; key: string; icon: typeof House };

/** Primary navigation, grouped by intent rather than alphabetically. */
const GROUPS: { items: NavItem[] }[] = [
  {
    items: [
      { href: "/today", key: "today", icon: House },
      { href: "/inbox", key: "inbox", icon: Tray },
      // The inputs have a home too — without this rail entry /sources was an
      // orphaned page no navigation reached (the "看不到信息源详情" report).
      { href: "/sources", key: "sources", icon: Rss },
      { href: "/discover", key: "discover", icon: Compass },
    ],
  },
  {
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

/**
 * VerticalRailItem — a rail entry set the way a spine of a book is set:
 * the mark above, the label running top-to-bottom beside it.
 *
 * Vertical CJK is not decoration here, it is the information architecture:
 * at 96px wide the rail holds every destination without truncating a single
 * character, which an icon-plus-horizontal-label rail cannot do.
 */
function VerticalRailItem({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof House;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`focus-ring group relative flex flex-col items-center gap-2 rounded-button px-1.5 py-3 transition-colors duration-200 ${
        active ? "bg-signal-dim text-signal" : "text-text-3 hover:bg-surface-hover hover:text-text-1"
      }`}
    >
      {/* Active mark: a solid rule down the leading edge, not a glow. */}
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-pill bg-signal transition-transform duration-200 ${
          active ? "scale-y-100" : "scale-y-0"
        }`}
      />
      <Icon size={17} weight={active ? "fill" : "regular"} className="shrink-0" />
      <span className="vrail text-[12px] font-medium tracking-[0.18em]">{label}</span>
    </Link>
  );
}

/**
 * Desktop vertical rail — the paper's spine.
 *
 * It never collapses: a 96px rail is already the narrowest thing that can hold
 * a vertical label, so there is nothing to gain by hiding it.
 */
export function Sidebar() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <aside
      aria-label={t("label")}
      className="sticky top-0 z-30 hidden h-dvh w-[96px] shrink-0 flex-col items-center border-r border-line bg-bg-0 md:flex"
    >
      {/* Seal at the head of the spine */}
      <div className="flex h-[68px] shrink-0 items-center justify-center">
        <BrandMark size={24} />
      </div>
      <div className="rule w-6" aria-hidden="true" />

      <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-3">
        {GROUPS.map(({ items }, gi) => (
          <div key={gi} className="flex flex-col items-center gap-1">
            {gi > 0 && <span className="rule my-1.5 w-6" aria-hidden="true" />}
            {items.map(({ href, key, icon }) => (
              <VerticalRailItem
                key={href}
                href={href}
                label={t(key)}
                icon={icon}
                active={isActive(pathname, href)}
              />
            ))}
          </div>
        ))}

        <div className="mt-auto flex flex-col items-center gap-1 pt-3">
          <span className="rule mb-1.5 w-6" aria-hidden="true" />
          <VerticalRailItem
            href="/settings/profile"
            label={t("settings")}
            icon={GearSix}
            active={isActive(pathname, "/settings")}
          />
          <VerticalRailItem
            href="/settings/security"
            label={t("signOut")}
            icon={SignOut}
            active={false}
          />
        </div>
      </nav>
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-1 md:hidden"
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
              <Icon size={19} weight={active ? "fill" : "regular"} />
              {t(key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
