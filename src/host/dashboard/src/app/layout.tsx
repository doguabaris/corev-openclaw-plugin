import type { Metadata } from 'next';
import { Quicksand } from 'next/font/google';
import './globals.css';
import React from 'react';

const quicksand = Quicksand({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Corev - Configs, Under Control.',
  description:
    'A minimal, open-source CLI tool for managing dynamic configuration repositories, with a focus on JSON files, on a per-project basis.',
  keywords: [
    'Corev',
    'dynamic configuration',
    'configuration management',
    'versioned config',
    'CLI tool',
    'DevOps',
    'infrastructure as code',
    'JSON schema',
    'distributed systems',
    'config CLI',
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${quicksand.variable} ${quicksand.variable} antialiased`}>{children}</body>
    </html>
  );
}
