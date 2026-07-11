'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../../../components/Navbar';
import { useAuth } from '../../../../../context/AuthContext';
import api from '../../../../../lib/api';
import { Plus, Trash2, Ticket, X } from 'lucide-react';

export default function ManagePromoCodesPage() {
  const { shopId } = useParams();
  const { user, loading } = useAuth();
  const router = useRouter();

  const [codes, setCodes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    code: '', discountType: 'percent', discountValue: 10, expiresAt: '', maxUses: '',
  });

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  function loadCodes() {
    api.get(`/promo-codes/manage/${shopId}`).then(({ data }) => setCodes(data.promoCodes));
  }

  useEffect(() => {
    if (user) loadCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, shopId]);

  function updateForm(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/promo-codes/manage/${shopId}`, {
        ...form,
        expiresAt: form.expiresAt || null,
        maxUses: form.maxUses ? parseInt(form.maxUses, 10) : null,
      });
      setShowForm(false);
      setForm({ code: '', discountType: 'percent', discountValue: 10, expiresAt: '', maxUses: '' });
      loadCodes();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la création du code.');
    }
  }

  async function toggleActive(promo) {
    await api.patch(`/promo-codes/manage/${shopId}/${promo.id}`, { isActive: !promo.is_active });
    loadCodes();
  }

  async function deleteCode(promo) {
    if (!confirm(`Supprimer le code "${promo.code}" ?`)) return;
    await api.delete(`/promo-codes/manage/${shopId}/${promo.id}`);
    loadCodes();
  }

  if (loading || !user) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Ticket className="h-6 w-6 text-brand-violetLight" /> Codes promo
          </h1>
          <button onClick={() => setShowForm((s) => !s)} className="btn-primary text-sm">
            {showForm ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            {showForm ? 'Annuler' : 'Nouveau code'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="card mb-8 space-y-4">
            {error && <p className="text-sm text-red-400">{error}</p>}

            <div>
              <label className="mb-1 block text-sm text-white/60">Code</label>
              <input
                required
                className="input-field uppercase"
                placeholder="SUMMER20"
                value={form.code}
                onChange={(e) => updateForm('code', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm text-white/60">Type</label>
                <select className="input-field" value={form.discountType} onChange={(e) => updateForm('discountType', e.target.value)}>
                  <option value="percent">Pourcentage</option>
                  <option value="fixed">Montant fixe (€)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-white/60">Valeur</label>
                <input
                  type="number"
                  min={0}
                  required
                  className="input-field"
                  value={form.discountValue}
                  onChange={(e) => updateForm('discountValue', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm text-white/60">Expiration (optionnel)</label>
                <input type="date" className="input-field" value={form.expiresAt} onChange={(e) => updateForm('expiresAt', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-white/60">Utilisations max (optionnel)</label>
                <input type="number" min={1} className="input-field" value={form.maxUses} onChange={(e) => updateForm('maxUses', e.target.value)} />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full">Créer le code</button>
          </form>
        )}

        {codes.length === 0 ? (
          <p className="text-white/40">Aucun code promo pour le moment.</p>
        ) : (
          <div className="space-y-3">
            {codes.map((c) => (
              <div key={c.id} className="card flex items-center justify-between">
                <div>
                  <p className="font-mono font-semibold text-brand-violetLight">{c.code}</p>
                  <p className="text-sm text-white/50">
                    {c.discount_type === 'percent' ? `-${c.discount_value}%` : `-${c.discount_value}€`}
                    {' · '}
                    {c.used_count} utilisation(s){c.max_uses ? ` / ${c.max_uses}` : ''}
                    {' · '}
                    {c.is_active ? 'Actif' : 'Inactif'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleActive(c)} className="btn-secondary text-xs">
                    {c.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                  <button onClick={() => deleteCode(c)} className="text-red-400">
                    <Trash2 className="h-4 w-4" />
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
