/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow importing from packages/* in the monorepo
  transpilePackages: ["@chatbot/shared-types"],
};

module.exports = nextConfig;
