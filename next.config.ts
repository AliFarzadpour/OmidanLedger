import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    // This is to allow cross-origin requests from the development environment (Firebase Studio).
    // In a future version of Next.js, this will be the default behavior.
    allowedDevOrigins: [
      'https://6000-firebase-studio-1764618882414.cluster-cxy3ise3prdrmx53pigwexthgs.cloudworkstations.dev',
    ],
  }
};

export default nextConfig;
