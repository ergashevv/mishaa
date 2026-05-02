import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: 'uploads.mangadex.org',
      },
      {
        protocol: 'https',
        hostname: 'i.annihil.us',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@azure/openai",
      "@google/generative-ai",
      "openai",
      "replicate",
    ],
  },
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
