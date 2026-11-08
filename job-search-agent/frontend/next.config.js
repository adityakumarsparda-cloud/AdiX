/** @type {import('next').NextConfig} */
const API = process.env.BACKEND_URL || "http://localhost:8000";

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Proxy /api/* to the FastAPI backend during local dev.
    return [{ source: "/api/:path*", destination: `${API}/api/:path*` }];
  },
};

module.exports = nextConfig;
