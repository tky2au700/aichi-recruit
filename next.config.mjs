/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    unoptimized: true,
  },

  async rewrites() {
    return [
      {
        source: "/media",
        destination: "https://wp.aichi-recruit.com/",
      },
      {
        source: "/media/:path*",
        destination: "https://wp.aichi-recruit.com/:path*",
      },
    ];
  },
};

export default nextConfig;