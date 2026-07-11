'use client';

import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { ShoppingBag, LayoutDashboard, LogOut, Repeat, UserCircle, LifeBuoy, Star } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-brand-black/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          <ShoppingBag className="h-6 w-6 text-brand-violetLight" />
          <span className="bg-brand-gradient bg-clip-text text-transparent">CecaShop</span>
        </Link>

        <nav className="flex items-center gap-2 overflow-x-auto">
          {user ? (
            <>
              <Link href="/subscriptions" className="btn-secondary text-sm">
                <Repeat className="mr-2 h-4 w-4" />
                Abonnements
              </Link>
              <Link href="/support" className="btn-secondary text-sm">
                <LifeBuoy className="mr-2 h-4 w-4" />
                Support
              </Link>
              <Link href="/reviews" className="btn-secondary text-sm">
                <Star className="mr-2 h-4 w-4" />
                Avis
              </Link>
              <Link href="/profile" className="btn-secondary text-sm">
                <UserCircle className="mr-2 h-4 w-4" />
                Profil
              </Link>
              <Link href="/dashboard" className="btn-secondary text-sm">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
              <button onClick={logout} className="btn-secondary text-sm">
                <LogOut className="mr-2 h-4 w-4" />
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-secondary text-sm">Connexion</Link>
              <Link href="/register" className="btn-primary text-sm">Créer un compte</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
