import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CodeCanvas - Circular Dependency Detector',
  description: 'Visual circular dependency detection and visualization for TypeScript/JavaScript monorepos',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
