import type { NextConfig } from "next";

// The public website is a static site: `npm run build` writes plain HTML to out/.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
