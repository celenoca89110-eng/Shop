'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../../components/Navbar';
import { CheckCircle2 } from 'lucide-react';

function SuccessContent() {
  const params = useSearchParams();
  const orderId = params.get('order');

  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <CheckCircle2 className="mx-auto mb-6 h-16 w-16 text-green-400" />
      <h1 className="mb-3 text-2xl font-bold">Commande confirmée !</h1>
      <p className="mb-8 text-white/50">
        Merci pour votre achat. Vous pouvez suivre l&apos;état de votre commande depuis votre
        espace personnel.
      </p>
      <div className="flex justify-center gap-3">
        {orderId && (
          <Link href={`/orders/${orderId}`} className="btn-primary">
            Voir la commande
          </Link>
        )}
        <Link href="/orders" className="btn-secondary">
          Toutes mes commandes
        </Link>
      </div>
    </main>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<main className="px-6 py-24 text-center text-white/40">Chargement…</main>}>
        <SuccessContent />
      </Suspense>
    </>
  );
}
