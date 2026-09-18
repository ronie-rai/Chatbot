const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow importing from packages/* in the monorepo
  transpilePackages: ["@chatbot/shared-types"],

  // Explicitly register the @ alias pointing to the server/ root.
  // path.resolve(__dirname) is always server/ regardless of CWD or tsconfig baseUrl
  // resolution quirks on Vercel Linux where baseUrl:"." can resolve to repo root.
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

module.exports = nextConfig;
