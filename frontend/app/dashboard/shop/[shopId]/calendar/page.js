'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../../../components/Navbar';
import { useAuth } from '../../../../../context/AuthContext';
import api from '../../../../../lib/api';
import { Calendar, Download, Search } from 'lucide-react';

const STATUS_LABELS = { active: 'Actif', expired: 'Expiré', cancelled: 'Annulé' };
const STATUS_COLORS = {
  active: 'bg-green-500/20 text-green-400',
  expired: 'bg-white/10 text-white/50',
  cancelled: 'bg-red-500/20 text-red-400',
};

function formatRemaining(endsAt, status) {
  if (status !== 'active') return '—';
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'Expire bientôt';
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return days >= 1 ? `${days} j` : `${Math.floor(ms / (1000 * 60 * 60))} h`;
}

function groupKey(dateStr, view) {
  const d = new Date(dateStr);
  if (view === 'day') return d.toLocaleDateString('fr-FR');
  if (view === 'month') return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  // week : numéro ISO approximatif
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay() + 1);
  return `Semaine du ${start.toLocaleDateString('fr-FR')}`;
}

export default function CalendarPage() {
  const { shopId } = useParams();
  const { user, loading } = useAuth();
  const router = useRouter();

  const [subscriptions, setSubscriptions] = useState([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('day');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  function load() {
    const params = {};
    if (status) params.status = status;
    if (search) params.search = search;
    api.get(`/subscriptions/calendar/${shopId}`, { params }).then(({ data }) => setSubscriptions(data.subscriptions));
  }

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, shopId, status, search]);

  const grouped = useMemo(() => {
    const groups = {};
    for (const sub of subscriptions) {
      const key = groupKey(sub.ends_at, view);
      if (!groups[key]) groups[key] = [];
      groups[key].push(sub);
    }
    return groups;
  }, [subscriptions, view]);

  async function handleExport() {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    const res = await api.get(`/subscriptions/calendar/${shopId}/export.csv?${params.toString()}`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'abonnements.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  if (loading || !user) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Calendar className="h-6 w-6 text-brand-violetLight" /> Calendrier des abonnements
          </h1>
          <button onClick={handleExport} className="btn-secondary text-sm">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </button>
        </div>

        <div className="card mb-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              placeholder="Rechercher un client ou un produit…"
              className="input-field pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input-field w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="expired">Expiré</option>
            <option value="cancelled">Annulé</option>
          </select>
          <div className="flex overflow-hidden rounded-xl border border-white/10">
            {['day', 'week', 'month'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-2 text-sm ${view === v ? 'bg-brand-violet text-white' : 'text-white/50 hover:bg-white/5'}`}
              >
                {v === 'day' ? 'Jour' : v === 'week' ? 'Semaine' : 'Mois'}
              </button>
            ))}
          </div>
        </div>

        {subscriptions.length === 0 ? (
          <p className="text-white/40">Aucun abonnement ne correspond à ces filtres.</p>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([key, subs]) => (
              <div key={key}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/40">{key}</h2>
                <div className="space-y-3">
                  {subs.map((sub) => (
                    <div key={sub.id} className="card flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{sub.username}</p>
                        <p className="text-sm text-white/50">{sub.product_name_snapshot}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-white/50">
                        <span>Début : {new Date(sub.starts_at).toLocaleDateString('fr-FR')}</span>
                        <span>Fin : {new Date(sub.ends_at).toLocaleDateString('fr-FR')}</span>
                        <span>{formatRemaining(sub.ends_at, sub.status)}</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[sub.status]}`}>
                          {STATUS_LABELS[sub.status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
