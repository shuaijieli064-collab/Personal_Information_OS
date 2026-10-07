import Link from "next/link";

/**
 * Root-level 404 for any unmatched path. Renders outside the [locale] layout,
 * so styles use CSS variables with dark fallbacks for theme awareness.
 */
export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "0 24px",
        textAlign: "center",
        background: "var(--bg-0, #050505)",
        color: "var(--text-1, #f5f6f7)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <p style={{ fontSize: 60, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
        404
      </p>
      <p style={{ fontSize: 14, color: "var(--text-2, #9ba1a8)", margin: 0 }}>
        这条路径没有信号。 / No signal on this path.
      </p>
      <Link
        href="/"
        style={{
          marginTop: 20,
          borderRadius: 8,
          border: "1px solid var(--line-strong, rgba(255,255,255,0.14))",
          background: "var(--bg-1, #080808)",
          padding: "10px 20px",
          fontSize: 14,
          color: "var(--text-1, #f5f6f7)",
          textDecoration: "none",
        }}
      >
        回到首页 / Back home
      </Link>
    </main>
  );
}
