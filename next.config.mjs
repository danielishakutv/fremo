/** @type {import('next').NextConfig} */

// Next.js dev mode uses eval() (HMR / source maps) and a WebSocket for hot
// reload, and localhost is served over http — so the strict production CSP would
// block all client JS in development. Loosen only in dev; keep prod locked down.
const isDev = process.env.NODE_ENV !== "production";
// Set FREMO_HTTPS=1 when the app is actually reachable over TLS (e.g. behind an
// Apache/nginx HTTPS reverse proxy). Off by default so a plain-HTTP deployment
// (http://IP:PORT) isn't broken by forced https upgrades of same-origin calls.
const httpsMode = process.env.FREMO_HTTPS === "1";

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];
if (!isDev && httpsMode) cspDirectives.push("upgrade-insecure-requests");

const csp = cspDirectives.join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  // HSTS only makes sense (and is only honored) over HTTPS.
  ...(httpsMode
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.net9ja.tv" },
      { protocol: "https", hostname: "**.dldownload.com.ng" },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // never cache API responses
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] },
    ];
  },
};

export default nextConfig;
