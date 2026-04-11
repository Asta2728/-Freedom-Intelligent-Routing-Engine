import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*", // Proxy to Backend
      },
      {
        source: "/media/:path*",
        destination: "http://localhost:8000/media/:path*", // Proxy to Backend Media
      },
    ];
  },
};

export default withNextIntl(nextConfig);
