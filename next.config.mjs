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
  async rewrites() {
    return [
      { source: '/sales', destination: '/dashboard/sales' },
      { source: '/sales/:path*', destination: '/dashboard/sales/:path*' },
      { source: '/marketplace', destination: '/dashboard/marketplace' },
      { source: '/production', destination: '/dashboard/production' },
      { source: '/production/:path*', destination: '/dashboard/production/:path*' },
      { source: '/status-pesanan', destination: '/dashboard/production/status' },
      { source: '/shipping', destination: '/dashboard/production/shipping' },
      { source: '/inventory', destination: '/dashboard/inventory' },
      { source: '/inventory/:path*', destination: '/dashboard/inventory/:path*' },
      { source: '/purchases', destination: '/dashboard/purchases' },
      { source: '/purchases/:path*', destination: '/dashboard/purchases/:path*' },
      { source: '/transactions', destination: '/dashboard/transactions' },
      { source: '/finance/:path*', destination: '/dashboard/finance/:path*' },
      { source: '/payroll', destination: '/dashboard/payroll' },
      { source: '/report', destination: '/dashboard/report' },
      { source: '/master/:path*', destination: '/dashboard/master/:path*' },
      { source: '/audit', destination: '/dashboard/audit' },
      { source: '/settings', destination: '/dashboard/settings/access' },
      { source: '/settings/:path*', destination: '/dashboard/settings/:path*' },
      { source: '/system-config', destination: '/dashboard/settings' },
    ];
  },
};

export default nextConfig;
