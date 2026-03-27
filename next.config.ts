import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '100.116.170.99',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '100.116.170.99',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
