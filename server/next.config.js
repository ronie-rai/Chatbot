/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow importing from packages/* in the monorepo
  transpilePackages: ["@chatbot/shared-types"],
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

