import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  // Next 16 native tree-shaking for icon/util barrels (replaces modularizeImports).
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Supabase Storage (project + signed URLs)
      { protocol: 'https', hostname: 'dfjyslxrzniqtlniseat.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

export default nextConfig;
