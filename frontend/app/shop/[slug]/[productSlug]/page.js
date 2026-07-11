'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import api from '../../../../lib/api';
import { useAuth } from '../../../../context/AuthContext';
import { Tag, ShoppingCart } from 'lucide-react';

function formatPrice(cents) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

const DURATION_LABELS = {
  weekly: 'hebdomadaire',
  monthly: 'mensuel',
  yearly: 'annuel',
  custom: 'personnalisé',
};

export default function ProductPage() {
  const { slug, productSlug } = useParams();
  const { user } = useAuth();
  const router = useRouter();

  const [product, setProduct] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [promoCode, setPromoCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get(`/products/shop/${slug}/${productSlug}`)
      .then(({ data }) => setProduct(data.product))
      .catch(() => setError('Produit introuvable.'));
  }, [slug, productSlug]);

  function updateField(fieldId, value) {
    setFieldValues((f) => ({ ...f, [fieldId]: value }));
  }

  async function handleBuy() {
    if (!user) {
      router.push('/login');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/orders/checkout', {
        shopSlug: slug,
        items: [{ productId: product.id, quantity: 1, fieldResponses: fieldValues }],
        promoCode: promoCode || undefined,
      });

      if (data.free) {
        router.push(`/checkout/success?order=${data.orderId}`);
      } else {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'achat.");
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !product) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-2xl px-6 py-20 text-center text-white/40">{error}</main>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-2xl px-6 py-20 text-center text-white/40">Chargement…</main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="card">
          {product.main_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.main_image_url}
              alt={product.name}
              className="mb-6 h-56 w-full rounded-xl object-cover"
            />
          )}

          <h1 className="mb-2 text-2xl font-bold">{product.name}</h1>
          <p className="mb-6 text-white/60">{product.description}</p>

          <p className="mb-6 text-3xl font-extrabold text-brand-violetLight">
            {product.is_free ? 'Gratuit' : formatPrice(product.price_cents)}
            {product.is_subscription && (
              <span className="ml-3 align-middle text-xs font-medium text-white/40">
                Abonnement {DURATION_LABELS[product.subscription_duration_type]}
              </span>
            )}
          </p>

          {product.fields?.length > 0 && (
            <div className="mb-6 space-y-4">
              <h2 className="text-sm font-semibold text-white/70">Informations requises</h2>
              {product.fields.map((field) => (
                <div key={field.id}>
                  <label className="mb-1 block text-sm text-white/60">
                    {field.label}
                    {field.is_required && <span className="text-red-400"> *</span>}
                  </label>
                  {field.field_type === 'text_long' ? (
                    <textarea
                      required={field.is_required}
                      className="input-field"
                      rows={3}
                      onChange={(e) => updateField(field.id, e.target.value)}
                    />
                  ) : field.field_type === 'select' ? (
                    <select
                      required={field.is_required}
                      className="input-field"
                      onChange={(e) => updateField(field.id, e.target.value)}
                    >
                      <option value="">Choisir…</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.field_type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      onChange={(e) => updateField(field.id, e.target.checked)}
                      className="h-5 w-5 rounded border-white/20 bg-brand-surface accent-brand-violet"
                    />
                  ) : (
                    <input
                      type={field.field_type === 'number' ? 'number' : 'text'}
                      required={field.is_required}
                      className="input-field"
                      onChange={(e) => updateField(field.id, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mb-6">
            <label className="mb-1 flex items-center gap-1.5 text-sm text-white/60">
              <Tag className="h-3.5 w-3.5" /> Code promo (optionnel)
            </label>
            <input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              className="input-field"
              placeholder="SUMMER20"
            />
          </div>

          {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

          <button onClick={handleBuy} disabled={submitting} className="btn-primary w-full">
            <ShoppingCart className="mr-2 h-4 w-4" />
            {submitting ? 'Traitement…' : product.is_free ? 'Obtenir gratuitement' : 'Acheter'}
          </button>
        </div>
      </main>
    </>
  );
}
