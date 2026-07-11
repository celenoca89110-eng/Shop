'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../../../components/Navbar';
import { useAuth } from '../../../../../context/AuthContext';
import api from '../../../../../lib/api';
import { BarChart3, TrendingUp, Users, Package, Repeat } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function formatPrice(cents) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export default function ShopStatsPage() {
  const { shopId } = useParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api.get(`/stats/${shopId}`).then(({ data }) => setStats(data));
  }, [user, shopId]);

  if (loading || !user || !stats) return null;

  const chartData = stats.monthlyRevenue.map((m) => ({
    month: m.month,
    revenue: m.revenueCents / 100,
  }));

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="mb-8 flex items-center gap-2 text-2xl font-bold">
          <BarChart3 className="h-6 w-6 text-brand-violetLight" /> Statistiques
        </h1>

        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card">
            <TrendingUp className="mb-2 h-5 w-5 text-brand-violetLight" />
            <p className="text-xs text-white/50">Chiffre d&apos;affaires total</p>
            <p className="text-xl font-bold">{formatPrice(stats.totalRevenueCents)}</p>
          </div>
          <div className="card">
            <TrendingUp className="mb-2 h-5 w-5 text-brand-violetLight" />
            <p className="text-xs text-white/50">Ce mois-ci</p>
            <p className="text-xl font-bold">{formatPrice(stats.monthRevenueCents)}</p>
          </div>
          <div className="card">
            <Users className="mb-2 h-5 w-5 text-brand-violetLight" />
            <p className="text-xs text-white/50">Clients</p>
            <p className="text-xl font-bold">{stats.totalCustomers}</p>
          </div>
          <div className="card">
            <Repeat className="mb-2 h-5 w-5 text-brand-violetLight" />
            <p className="text-xs text-white/50">Abonnements actifs</p>
            <p className="text-xl font-bold">{stats.activeSubscriptions}</p>
          </div>
        </div>

        <div className="card mb-8">
          <h2 className="mb-4 font-semibold">Revenus (6 derniers mois)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" fontSize={12} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: '#131320', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  formatter={(value) => [`${value.toFixed(2)}€`, 'Revenu']}
                />
                <Bar dataKey="revenue" fill="#7c3aed" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card">
            <h2 className="mb-4 flex items-center gap-2 font-semibold">
              <Package className="h-4 w-4 text-brand-violetLight" /> Meilleurs produits
            </h2>
            {stats.topProducts.length === 0 ? (
              <p className="text-sm text-white/40">Aucune vente pour le moment.</p>
            ) : (
              <div className="space-y-2">
                {stats.topProducts.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{p.name}</span>
                    <span className="text-white/50">{p.unitsSold} vendu(s) · {formatPrice(p.revenueCents)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="mb-4 font-semibold">Commandes récentes</h2>
            {stats.recentOrders.length === 0 ? (
              <p className="text-sm text-white/40">Aucune commande pour le moment.</p>
            ) : (
              <div className="space-y-2">
                {stats.recentOrders.map((o) => (
                  <div key={o.id} className="flex justify-between text-sm">
                    <span>#{o.order_number} — {o.username}</span>
                    <span className="text-white/50">{formatPrice(o.total_cents)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
