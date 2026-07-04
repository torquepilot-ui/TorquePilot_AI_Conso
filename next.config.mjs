import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // nip.io is needed so the HMR WebSocket origin check passes when accessing
  // the dev server remotely via http://192-168-1-50.nip.io:3026.
  // Without this entry Next.js returns 403 on /_next/webpack-hmr, which
  // blocks React hydration in the browser.
  allowedDevOrigins: ["192.168.1.50", "100.84.234.6", "192-168-1-50.nip.io"],
};

export default withNextIntl(nextConfig);
