/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@stablenet/core', '@stablenet/stealth-sdk'],
}

module.exports = nextConfig
