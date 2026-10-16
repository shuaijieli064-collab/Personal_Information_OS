/**
 * A `next-intl` test double that validates instead of pretending.
 *
 * The components assert on translation KEYS, so the mock echoes the key back — but it first
 * resolves it against the real `zh-CN` catalogue and throws when the key is absent.
 *
 * A plain echo would happily pass a component that references a key nobody ever added, which
 * is exactly the bug a browser pass caught in the automation console (a missing
 * `Automation.notifBrief`): tsc, eslint and the unit tests were all green while the page
 * threw MISSING_MESSAGE at runtime. Resolving for real means the unit tests catch it too.
 *
 * Usage:
 *   vi.mock("next-intl", async () => (await import("@/test/i18n")).catalogMock());
 */
export async function catalogMock() {
  // `Enums` nests one level deeper than the flat namespaces, so the values are `unknown`
  // and the lookup checks the shape rather than trusting the cast.
  const zh = ((await import("@/messages/zh-CN.json")).default ?? {}) as Record<
    string,
    Record<string, unknown>
  >;

  return {
    useTranslations:
      (namespace?: string) => (key: string, values?: Record<string, unknown>) => {
        const dict = namespace ? zh[namespace] : zh;
        if (!dict || typeof dict[key] !== "string") {
          throw new Error(
            `MISSING_MESSAGE: Could not resolve \`${namespace ? namespace + "." : ""}${key}\` in messages.`,
          );
        }
        return values ? `${key}:${JSON.stringify(values)}` : key;
      },
  };
}
