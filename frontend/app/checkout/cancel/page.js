'use client';

import Link from 'next/link';
import Navbar from '../../../components/Navbar';
import { XCircle } from 'lucide-react';

export default function CheckoutCancelPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <XCircle className="mx-auto mb-6 h-16 w-16 text-red-400" />
        <h1 className="mb-3 text-2xl font-bold">Paiement annulé</h1>
        <p className="mb-8 text-white/50">
          Votre commande n&apos;a pas été finalisée. Vous pouvez réessayer à tout moment.
        </p>
        <Link href="/" className="btn-primary">
          Retour à l&apos;accueil
        </Link>
      </main>
    </>
  );
}
