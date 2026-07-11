/**
 * Calcule la date de fin d'un abonnement à partir d'une date de départ
 * et de la configuration de durée du produit.
 */
function computeSubscriptionEnd(startDate, product) {
  const end = new Date(startDate);

  switch (product.subscription_duration_type) {
    case 'weekly':
      end.setDate(end.getDate() + 7);
      break;
    case 'monthly':
      end.setMonth(end.getMonth() + 1);
      break;
    case 'yearly':
      end.setFullYear(end.getFullYear() + 1);
      break;
    case 'custom':
    default:
      end.setDate(end.getDate() + (parseInt(product.subscription_duration_days, 10) || 30));
      break;
  }

  return end;
}

module.exports = { computeSubscriptionEnd };
