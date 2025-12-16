/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 静的エクスポート（SSGモード）
  output: 'export',
  // 画像最適化を無効化（静的サイト用）
  images: {
    unoptimized: true,
  },
  // トレイリングスラッシュを有効化
  trailingSlash: true,
};

module.exports = nextConfig;
