import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Resolves `src/i18n/request.ts` by default.
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  /* config options here */
};

export default withNextIntl(nextConfig);
