'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { ClipboardList } from 'lucide-react';

const STATUS_LABELS = {
  pending: 'En attente',
  paid: 'Payée',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
  subscription_active: 'Abonnement actif',
  subscription_cancelled: 'Abonnement annulé',
  subscription_expired: 'Abonnement expiré',
};

const STATUS_COLORS = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  paid: 'bg-green-500/20 text-green-400',
  in_progress: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
  subscription_active: 'bg-brand-violet/20 text-brand-violetLight',
  subscription_cancelled: 'bg-red-500/20 text-red-400',
  subscription_expired: 'bg-white/10 text-white/50',
};

function formatPrice(cents) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export default function OrdersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api
      .get('/orders/me')
      .then(({ data }) => setOrders(data.orders))
      .finally(() => setLoadingOrders(false));
  }, [user]);

  if (loading || !user) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="mb-8 flex items-center gap-2 text-2xl font-bold">
          <ClipboardList className="h-6 w-6 text-brand-violetLight" />
          Mes commandes
        </h1>

        {loadingOrders ? (
          <p className="text-white/40">Chargement…</p>
        ) : orders.length === 0 ? (
          <p className="text-white/40">Vous n&apos;avez pas encore de commande.</p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`} className="card flex items-center justify-between hover:border-brand-violet/50">
                <div>
                  <p className="font-semibold">Commande #{order.order_number}</p>
                  <p className="text-sm text-white/50">{order.shop_name}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                  <span className="font-semibold">{formatPrice(order.total_cents)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
