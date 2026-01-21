/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@stablenet/core', '@stablenet/plugin-stealth'],
}

module.exports = nextConfig
