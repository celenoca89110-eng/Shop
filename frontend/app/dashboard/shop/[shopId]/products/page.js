'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../../../components/Navbar';
import { useAuth } from '../../../../../context/AuthContext';
import api from '../../../../../lib/api';
import { Plus, Trash2, Package, X, Paperclip, Upload } from 'lucide-react';

const EMPTY_FIELD = { label: '', fieldType: 'text_short', isRequired: true, options: [] };

function formatPrice(cents) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export default function ManageProductsPage() {
  const { shopId } = useParams();
  const { user, loading } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', description: '', priceCents: 0, isFree: false,
    stockType: 'unlimited', stockQuantity: 0, category: '', isFeatured: false,
    isSubscription: false, subscriptionDurationType: 'monthly', subscriptionDurationDays: 30,
    subscriptionAutoRenewDefault: false, discordRoleId: '',
  });
  const [fields, setFields] = useState([]);
  const [expandedFiles, setExpandedFiles] = useState(null);
  const [filesByProduct, setFilesByProduct] = useState({});
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  function loadProducts() {
    api.get(`/products/manage/${shopId}`).then(({ data }) => setProducts(data.products));
  }

  useEffect(() => {
    if (user) loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, shopId]);

  function updateForm(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function addField() {
    setFields((f) => [...f, { ...EMPTY_FIELD }]);
  }

  function updateFieldAt(idx, key, value) {
    setFields((f) => f.map((item, i) => (i === idx ? { ...item, [key]: value } : item)));
  }

  function removeField(idx) {
    setFields((f) => f.filter((_, i) => i !== idx));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/products/manage/${shopId}`, { ...form, fields });
      setShowForm(false);
      setForm({
        name: '', description: '', priceCents: 0, isFree: false,
        stockType: 'unlimited', stockQuantity: 0, category: '', isFeatured: false,
        isSubscription: false, subscriptionDurationType: 'monthly', subscriptionDurationDays: 30,
        subscriptionAutoRenewDefault: false, discordRoleId: '',
      });
      setFields([]);
      loadProducts();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la création du produit.');
    }
  }

  async function toggleActive(product) {
    await api.patch(`/products/manage/${shopId}/${product.id}`, { isActive: !product.is_active });
    loadProducts();
  }

  async function deleteProduct(product) {
    if (!confirm(`Supprimer "${product.name}" ?`)) return;
    await api.delete(`/products/manage/${shopId}/${product.id}`);
    loadProducts();
  }

  async function loadFiles(productId) {
    const { data } = await api.get(`/products/manage/${shopId}/${productId}/files`);
    setFilesByProduct((f) => ({ ...f, [productId]: data.files }));
  }

  function toggleFilesPanel(productId) {
    if (expandedFiles === productId) {
      setExpandedFiles(null);
    } else {
      setExpandedFiles(productId);
      if (!filesByProduct[productId]) loadFiles(productId);
    }
  }

  async function handleFileUpload(productId, fileList) {
    const file = fileList?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/products/manage/${shopId}/${productId}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      loadFiles(productId);
    } catch (err) {
      alert(err.response?.data?.error || "Erreur lors de l'upload du fichier.");
    } finally {
      setUploading(false);
    }
  }

  async function handleFileDelete(productId, fileId) {
    if (!confirm('Supprimer ce fichier ?')) return;
    await api.delete(`/products/manage/${shopId}/${productId}/files/${fileId}`);
    loadFiles(productId);
  }

  if (loading || !user) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Package className="h-6 w-6 text-brand-violetLight" /> Produits
          </h1>
          <button onClick={() => setShowForm((s) => !s)} className="btn-primary text-sm">
            {showForm ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            {showForm ? 'Annuler' : 'Nouveau produit'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="card mb-8 space-y-4">
            {error && <p className="text-sm text-red-400">{error}</p>}

            <div>
              <label className="mb-1 block text-sm text-white/60">Nom</label>
              <input required className="input-field" value={form.name} onChange={(e) => updateForm('name', e.target.value)} />
            </div>

            <div>
              <label className="mb-1 block text-sm text-white/60">Description</label>
              <textarea className="input-field" rows={3} value={form.description} onChange={(e) => updateForm('description', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 flex items-center gap-2 text-sm text-white/60">
                  <input type="checkbox" checked={form.isFree} onChange={(e) => updateForm('isFree', e.target.checked)} />
                  Produit gratuit
                </label>
                {!form.isFree && (
                  <input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Prix en centimes (ex: 999 = 9,99€)"
                    className="input-field mt-2"
                    value={form.priceCents}
                    onChange={(e) => updateForm('priceCents', e.target.value)}
                  />
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm text-white/60">Catégorie</label>
                <input className="input-field" value={form.category} onChange={(e) => updateForm('category', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm text-white/60">Stock</label>
                <select className="input-field" value={form.stockType} onChange={(e) => updateForm('stockType', e.target.value)}>
                  <option value="unlimited">Illimité</option>
                  <option value="limited">Limité</option>
                </select>
              </div>
              {form.stockType === 'limited' && (
                <div>
                  <label className="mb-1 block text-sm text-white/60">Quantité</label>
                  <input type="number" min={0} className="input-field" value={form.stockQuantity} onChange={(e) => updateForm('stockQuantity', e.target.value)} />
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-white/60">
              <input type="checkbox" checked={form.isFeatured} onChange={(e) => updateForm('isFeatured', e.target.checked)} />
              Mettre en avant
            </label>

            <div className="rounded-xl border border-white/10 p-4">
              <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/80">
                <input
                  type="checkbox"
                  checked={form.isSubscription}
                  onChange={(e) => updateForm('isSubscription', e.target.checked)}
                />
                Ce produit est un abonnement (ex : VIP 1 mois, Netflix 30 jours…)
              </label>

              {form.isSubscription && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm text-white/60">Durée</label>
                    <select
                      className="input-field"
                      value={form.subscriptionDurationType}
                      onChange={(e) => updateForm('subscriptionDurationType', e.target.value)}
                    >
                      <option value="weekly">Hebdomadaire (7 jours)</option>
                      <option value="monthly">Mensuel (1 mois)</option>
                      <option value="yearly">Annuel (1 an)</option>
                      <option value="custom">Durée personnalisée</option>
                    </select>
                  </div>
                  {form.subscriptionDurationType === 'custom' && (
                    <div>
                      <label className="mb-1 block text-sm text-white/60">Nombre de jours</label>
                      <input
                        type="number"
                        min={1}
                        className="input-field"
                        value={form.subscriptionDurationDays}
                        onChange={(e) => updateForm('subscriptionDurationDays', e.target.value)}
                      />
                    </div>
                  )}
                  <label className="col-span-2 flex items-center gap-2 text-sm text-white/60">
                    <input
                      type="checkbox"
                      checked={form.subscriptionAutoRenewDefault}
                      onChange={(e) => updateForm('subscriptionAutoRenewDefault', e.target.checked)}
                    />
                    Renouvellement automatique activé par défaut à l&apos;achat
                  </label>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm text-white/60">Rôle Discord à attribuer (optionnel)</label>
              <input
                className="input-field"
                placeholder="ID du rôle Discord, ex: 987654321098765432"
                value={form.discordRoleId}
                onChange={(e) => updateForm('discordRoleId', e.target.value)}
              />
              <p className="mt-1 text-xs text-white/30">
                Attribué automatiquement à l&apos;achat (retiré à l&apos;expiration pour un abonnement).
                Nécessite que le client ait lié son Discord et que la boutique ait un Guild ID configuré (Réglages).
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white/70">Champs dynamiques</h3>
                <button type="button" onClick={addField} className="btn-secondary text-xs">
                  <Plus className="mr-1 h-3 w-3" /> Ajouter un champ
                </button>
              </div>
              {fields.map((f, idx) => (
                <div key={idx} className="mb-2 flex items-center gap-2">
                  <input
                    placeholder="Ex: Pseudo Discord"
                    className="input-field"
                    value={f.label}
                    onChange={(e) => updateFieldAt(idx, 'label', e.target.value)}
                  />
                  <select
                    className="input-field w-40"
                    value={f.fieldType}
                    onChange={(e) => updateFieldAt(idx, 'fieldType', e.target.value)}
                  >
                    <option value="text_short">Texte court</option>
                    <option value="text_long">Texte long</option>
                    <option value="number">Nombre</option>
                    <option value="select">Liste déroulante</option>
                    <option value="checkbox">Case à cocher</option>
                  </select>
                  <button type="button" onClick={() => removeField(idx)} className="text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <button type="submit" className="btn-primary w-full">Créer le produit</button>
          </form>
        )}

        {products.length === 0 ? (
          <p className="text-white/40">Aucun produit pour le moment.</p>
        ) : (
          <div className="space-y-3">
            {products.map((p) => (
              <div key={p.id} className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-sm text-white/50">
                      {p.is_free ? 'Gratuit' : formatPrice(p.price_cents)} · {p.is_active ? 'Actif' : 'Inactif'}
                      {p.is_subscription && ' · Abonnement'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => toggleFilesPanel(p.id)} className="btn-secondary text-xs">
                      <Paperclip className="mr-1.5 h-3.5 w-3.5" /> Fichiers
                    </button>
                    <button onClick={() => toggleActive(p)} className="btn-secondary text-xs">
                      {p.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                    <button onClick={() => deleteProduct(p)} className="text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {expandedFiles === p.id && (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <label className="btn-secondary inline-flex cursor-pointer text-xs">
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      {uploading ? 'Envoi…' : 'Ajouter un fichier'}
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => handleFileUpload(p.id, e.target.files)}
                      />
                    </label>
                    <p className="mt-1 text-xs text-white/30">
                      ZIP, EXE, TXT, PDF, images, scripts FiveM… (100 Mo max). Livré automatiquement au client après achat.
                    </p>

                    <div className="mt-3 space-y-2">
                      {(filesByProduct[p.id] || []).length === 0 ? (
                        <p className="text-xs text-white/30">Aucun fichier attaché.</p>
                      ) : (
                        filesByProduct[p.id].map((f) => (
                          <div key={f.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                            <span className="truncate">{f.file_name}</span>
                            <button onClick={() => handleFileDelete(p.id, f.id)} className="text-red-400">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
