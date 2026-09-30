const path = require('path');
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/chatbot-server-seven-phi\.vercel\.app\/api\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'ofa-api-cache',
        expiration: { maxEntries: 32, maxAgeSeconds: 60 },
        networkTimeoutSeconds: 10,
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'ofa-image-cache',
        expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\.(?:js|css)$/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'ofa-static-cache' },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow importing from packages/* in the monorepo
  transpilePackages: ["@chatbot/shared-types"],

  // Skip type-checking and linting during `next build`.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // Explicitly register the @ alias pointing to the server/ root.
  webpack(config) {
    config.resolve.alias['@'] = path.resolve(__dirname);
    return config;
  },

  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Requested-With, Accept" },
        ],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
