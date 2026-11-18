import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'L.U.M.E. | Painel',
  description: 'Painel de administração e parceiros do L.U.M.E.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
