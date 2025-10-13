import type { NextConfig } from "next";
// @ts-ignore - next-pwa doesn't have TypeScript definitions
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // Disable in dev, enable in production
  // Ensure webpack is used for PWA generation
  buildExcludes: [/middleware-manifest\.json$/, /middleware-runtime\.js$/],
})(nextConfig);
