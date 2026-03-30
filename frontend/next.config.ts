import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/vigil-prod-7788-vigil-portraits/**",
      },
    ],
  },
};

export default nextConfig;
