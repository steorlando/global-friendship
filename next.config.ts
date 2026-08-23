import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/manager/statistics/participant-badges": [
      "./data/badges/badge-v2-background.jpg",
      "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSansCondensed-Bold.ttf",
    ],
    "/api/admin/statistics/participation-report": [
      "./data/participation-report-2025.json",
      "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSansCondensed.ttf",
      "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSansCondensed-Bold.ttf",
    ],
  },
};

export default nextConfig;
