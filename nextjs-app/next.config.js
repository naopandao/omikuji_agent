/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Amplify Hosting 用の設定
  output: 'standalone',
  // 画像最適化の設定
  images: {
    domains: [],
  },
};

module.exports = nextConfig;
