import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lwzkhbxfuqfokiprhatv.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/sales',
        destination: '/dashboard/sales',
        permanent: false,
      },
      {
        source: '/sales-order',
        destination: '/dashboard/sales',
        permanent: false,
      },
      {
        source: '/inventory',
        destination: '/dashboard/inventory',
        permanent: false,
      }
    ];
  },
};

export default nextConfig;
