const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[CecaShop] ATTENTION: STRIPE_SECRET_KEY non défini — les paiements échoueront.');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-06-20',
});

module.exports = stripe;
