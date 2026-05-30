/** @type {import('next').NextConfig} */

// Security response headers (docs/auth.md "Cookies and headers"). HSTS only
// matters over HTTPS (ignored on localhost), the rest apply everywhere.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  webpack(config, { isServer }) {
    if (isServer) {
      // Prevent webpack from polyfilling Node.js built-ins used by mongoose/dns.
      // Without this, `import dns from "dns"` may resolve to a browser stub that
      // ignores dns.setServers() calls, breaking mongodb+srv:// SRV lookups.
      const externals = Array.isArray(config.externals)
        ? config.externals
        : config.externals
          ? [config.externals]
          : [];
      config.externals = [
        ...externals,
        ({ request }, callback) => {
          if (["dns", "net", "tls"].includes(request)) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
