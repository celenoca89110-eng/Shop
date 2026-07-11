'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import api from '../lib/api';
import { Store } from 'lucide-react';

export default function HomePage() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/shops')
      .then(({ data }) => setShops(data.shops))
      .catch(() => setShops([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <section className="mb-16 text-center">
          <h1 className="mb-4 text-4xl font-extrabold sm:text-5xl">
            Bienvenue sur{' '}
            <span className="bg-brand-gradient bg-clip-text text-transparent">CecaShop</span>
          </h1>
          <p className="mx-auto max-w-xl text-white/60">
            La marketplace nouvelle génération pour produits numériques, abonnements et
            services gaming.
          </p>
        </section>

        <section>
          <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold">
            <Store className="h-5 w-5 text-brand-violetLight" />
            Boutiques
          </h2>

          {loading ? (
            <p className="text-white/40">Chargement des boutiques…</p>
          ) : shops.length === 0 ? (
            <p className="text-white/40">Aucune boutique disponible pour le moment.</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {shops.map((shop) => (
                <Link
                  key={shop.id}
                  href={`/shop/${shop.slug}`}
                  className="card group transition hover:border-brand-violet/50"
                >
                  <div
                    className="mb-4 h-28 w-full rounded-xl bg-brand-gradient"
                    style={{
                      background: `linear-gradient(135deg, ${shop.color_primary}, ${shop.color_secondary})`,
                    }}
                  />
                  <h3 className="text-lg font-semibold group-hover:text-brand-violetLight">
                    {shop.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-white/50">
                    {shop.description || 'Aucune description.'}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
