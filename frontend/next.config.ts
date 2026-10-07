import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // @phosphor-icons/react ships a barrel of ~7k icon modules; without this the
    // whole barrel is resolved for the 5 files that import named icons.
    // (recharts / lucide-react / date-fns are already in Next's default list.)
    optimizePackageImports: ["@phosphor-icons/react"],
  },
};

export default withNextIntl(nextConfig);
