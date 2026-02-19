import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Draftly Studio — Open Source AI Studio',
  description: 'AI image & video generation with visual node workflows. Runs locally on your GPU.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        />
      </head>
      <body className="bg-[#0a0a0a] text-white antialiased">{children}</body>
    </html>
  );
}
