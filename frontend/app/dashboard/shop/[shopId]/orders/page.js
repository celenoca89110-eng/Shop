'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../../../components/Navbar';
import { useAuth } from '../../../../../context/AuthContext';
import api from '../../../../../lib/api';
import { ClipboardList, Archive } from 'lucide-react';

const STATUS_OPTIONS = [
  'pending', 'paid', 'in_progress', 'completed', 'cancelled',
  'subscription_active', 'subscription_cancelled', 'subscription_expired',
];

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

function formatPrice(cents) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export default function ManageOrdersPage() {
  const { shopId } = useParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  function loadOrders() {
    api.get(`/orders/manage/${shopId}`).then(({ data }) => setOrders(data.orders));
  }

  useEffect(() => {
    if (user) loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, shopId]);

  async function updateStatus(order, status) {
    await api.patch(`/orders/manage/${shopId}/${order.id}/status`, { status });
    loadOrders();
  }

  async function archiveOrder(order) {
    await api.patch(`/orders/manage/${shopId}/${order.id}/archive`, { archived: true });
    loadOrders();
  }

  if (loading || !user) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="mb-8 flex items-center gap-2 text-2xl font-bold">
          <ClipboardList className="h-6 w-6 text-brand-violetLight" /> Commandes
        </h1>

        {orders.length === 0 ? (
          <p className="text-white/40">Aucune commande pour le moment.</p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Commande #{order.order_number}</p>
                  <p className="text-sm text-white/50">{order.username} ({order.email})</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{formatPrice(order.total_cents)}</span>
                  <select
                    value={order.status}
                    onChange={(e) => updateStatus(order, e.target.value)}
                    className="input-field w-auto py-1.5 text-sm"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  <button onClick={() => archiveOrder(order)} className="text-white/40 hover:text-white">
                    <Archive className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
