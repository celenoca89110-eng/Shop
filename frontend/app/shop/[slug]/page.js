'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../../components/Navbar';
import api from '../../../lib/api';
import { Star, Package } from 'lucide-react';

function formatPrice(cents) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export default function ShopPage() {
  const { slug } = useParams();
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/shops/${slug}`)
      .then(({ data }) => setShop(data.shop))
      .catch(() => setError('Boutique introuvable.'));

    api
      .get(`/products/shop/${slug}`)
      .then(({ data }) => setProducts(data.products))
      .catch(() => setProducts([]));
  }, [slug]);

  if (error) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-4xl px-6 py-20 text-center text-white/40">{error}</main>
      </>
    );
  }

  if (!shop) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-4xl px-6 py-20 text-center text-white/40">
          Chargement…
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div
        className="h-48 w-full"
        style={{
          background: `linear-gradient(135deg, ${shop.color_primary}, ${shop.color_secondary})`,
        }}
      />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mb-2 text-3xl font-bold">{shop.name}</h1>
        <p className="mb-10 text-white/50">{shop.description}</p>

        <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold">
          <Package className="h-5 w-5 text-brand-violetLight" />
          Catalogue
        </h2>

        {products.length === 0 ? (
          <div className="card text-center text-white/40">
            Aucun produit disponible pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/shop/${slug}/${p.slug}`}
                className="card group flex flex-col transition hover:border-brand-violet/50"
              >
                <div className="mb-4 flex h-32 items-center justify-center rounded-xl bg-white/5">
                  {p.main_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.main_image_url} alt={p.name} className="h-full w-full rounded-xl object-cover" />
                  ) : (
                    <Package className="h-10 w-10 text-white/20" />
                  )}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold group-hover:text-brand-violetLight">{p.name}</h3>
                  {p.is_featured && <Star className="h-4 w-4 shrink-0 text-yellow-400" />}
                </div>
                <p className="mt-1 line-clamp-2 flex-1 text-sm text-white/50">{p.description}</p>
                <p className="mt-3 text-lg font-bold text-brand-violetLight">
                  {p.is_free ? 'Gratuit' : formatPrice(p.price_cents)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
