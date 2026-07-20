/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@arya/shared'],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
