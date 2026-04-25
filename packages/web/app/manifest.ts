import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Boardsesh',
    short_name: 'Boardsesh',
    description: 'Track your sends across Kilter, Tension, and MoonBoard. One app for your boards.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0e0e10',
    theme_color: '#0e0e10',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
