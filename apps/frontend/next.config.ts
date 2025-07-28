import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/api/sessions/**',
      },
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/api/sessions/**',
      },
    ],
  },
};

export default nextConfig;
