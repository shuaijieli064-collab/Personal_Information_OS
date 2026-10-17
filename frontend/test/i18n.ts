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
 * Both dotted paths (`toolDesc.addGoal`) and `t.has` are supported, because the real
 * translator supports them and a double that is narrower than the real thing fails on
 * correct code.
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

  /** Walks a dotted path; returns undefined unless it lands on a string leaf. */
  function resolve(namespace: string | undefined, key: string): string | undefined {
    const root = namespace ? zh[namespace] : zh;
    if (!root) return undefined;
    let cur: unknown = root;
    for (const part of key.split(".")) {
      if (!cur || typeof cur !== "object" || !(part in (cur as Record<string, unknown>))) {
        return undefined;
      }
      cur = (cur as Record<string, unknown>)[part];
    }
    return typeof cur === "string" ? cur : undefined;
  }

  return {
    useTranslations: (namespace?: string) => {
      const translate = (key: string, values?: Record<string, unknown>) => {
        const value = resolve(namespace, key);
        if (value === undefined) {
          throw new Error(
            `MISSING_MESSAGE: Could not resolve \`${namespace ? namespace + "." : ""}${key}\` in messages.`,
          );
        }
        return values ? `${key}:${JSON.stringify(values)}` : key;
      };
      translate.has = (key: string) => resolve(namespace, key) !== undefined;
      return translate;
    },
  };
}
