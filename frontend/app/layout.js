import './globals.css';
import { AuthProvider } from '../context/AuthContext';

export const metadata = {
  title: 'CecaShop — Marketplace gaming',
  description: 'La marketplace de produits numériques nouvelle génération.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className="dark">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
