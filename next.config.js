/** @type {import('next').NextConfig} */
const nextConfig = {
  // PWA를 위한 헤더 설정
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
