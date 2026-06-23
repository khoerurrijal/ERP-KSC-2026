/**
 * Centralized Pricing Logic
 * This file is the Single Source of Truth for all price calculations in the application.
 */

export function calculateItemPrice({
  product,          // Object: product data from database { base_price, workshop_code, category }
  qty,              // Number: quantity being ordered
  orderType,        // String: 'SABLON', 'Sablon', 'POLOS', 'Polos'
  isTwoColor,       // Boolean: is it a 2 color sablon?
  pricelistConfig   // Object: from system_settings 'pricelist_config'
}) {
  if (!product) return 0;
  
  const baseHpp = Number(product.base_price || 0);
  const qtyInt = parseInt(qty, 10) || 1;
  const isSablon = (orderType || '').toUpperCase() === 'SABLON';

  // 1. Calculate Harga Beli King (Base Cost + Workshop Margin)
  let hargaBeliKing = baseHpp;
  if (product.workshop_code === 'GUDANG') {
    const profitGudang = pricelistConfig?.profit_gudang_nominal !== undefined && pricelistConfig?.profit_gudang_nominal !== '' 
      ? Number(pricelistConfig.profit_gudang_nominal) 
      : 50;
    hargaBeliKing = baseHpp + profitGudang;
  } else if (product.workshop_code === 'GLOBAL') {
    const profitGlobal = pricelistConfig?.profit_global_percent !== undefined && pricelistConfig?.profit_global_percent !== '' 
      ? Number(pricelistConfig.profit_global_percent) 
      : 10;
    hargaBeliKing = baseHpp * (1 + (profitGlobal / 100));
  }

  let basePrice = hargaBeliKing;

  // 2. Add Sablon Fee OR Polos Margin
  if (isSablon) {
    let currentSablonFee = 0;
    const cat = product.category;
    const sablonMatrix = pricelistConfig?.sablon_matrix || {};
    
    // Check if category exists in matrix
    if (cat && sablonMatrix[cat]) {
      const tierMatrix = sablonMatrix[cat];
      // Note: Matrix tiers are matched from highest qty to lowest
      if (qtyInt >= 10000 && tierMatrix["10000"] > 0) currentSablonFee = tierMatrix["10000"];
      else if (qtyInt >= 5000 && tierMatrix["5000"] > 0) currentSablonFee = tierMatrix["5000"];
      else if (qtyInt >= 1000 && tierMatrix["1000"] > 0) currentSablonFee = tierMatrix["1000"];
      else if (qtyInt >= 500 && tierMatrix["500"] > 0) currentSablonFee = tierMatrix["500"];
      else if (qtyInt >= 100 && tierMatrix["100"] > 0) currentSablonFee = tierMatrix["100"];
      else if (qtyInt >= 10 && tierMatrix["10"] > 0) currentSablonFee = tierMatrix["10"];
      else if (tierMatrix["1"] > 0) currentSablonFee = tierMatrix["1"];
      else currentSablonFee = tierMatrix["1000"] || 250; // default fallback if no tier matches
    } else {
      // Fallback if category has no matrix
      currentSablonFee = 250;
    }
    
    basePrice += currentSablonFee;
    
    // Additional fee for 2 colors
    if (isTwoColor) {
      basePrice += 250;
    }
  } else {
    // POLOS Margin
    const marginPolos = pricelistConfig?.margin_jual_polos_percent !== undefined && pricelistConfig?.margin_jual_polos_percent !== '' 
      ? Number(pricelistConfig.margin_jual_polos_percent) 
      : 15;
    basePrice = basePrice * (1 + (marginPolos / 100));
  }

  // 3. Add Save Profit (The Final Global Markup)
  const saveProfitPct = pricelistConfig?.save_profit_percent !== undefined && pricelistConfig?.save_profit_percent !== '' 
    ? Number(pricelistConfig.save_profit_percent) 
    : 30;
  basePrice = basePrice * (1 + (saveProfitPct / 100));

  // 4. Return rounded up price
  return Math.ceil(basePrice);
}
