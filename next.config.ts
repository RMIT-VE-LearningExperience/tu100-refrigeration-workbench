import type { NextConfig } from 'next';
// BASE_PATH is the public path prefix of the deployed site: '' at a domain root (Sites), '/<repo>' on a
// GitHub project page. Only assetPrefix is used: the exported files stay at the artifact root, which the
// host serves under the prefix, while chunk URLs and (through NEXT_PUBLIC_BASE_PATH) public assets carry it.
const prefix = process.env.BASE_PATH ?? '';
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  ...(prefix ? { assetPrefix: prefix } : {}),
  env: { NEXT_PUBLIC_BASE_PATH: prefix },
};
export default nextConfig;
