
'use server';

import { db } from '@/lib/admin-db';
import { startOfMonth, endOfMonth, format } from 'date-fns';

// --- SYSTEM DEFAULTS & PRICING RULES ---
const DEFAULT_PCT = 0.0075;
const DEFAULT_UNIT_CAP = 30.00;
const DEFAULT_MIN_FEE = 29.00;

export interface FeeCalculationResult {
    userId: string;
    userEmail: string;
    activeUnits: number;
    totalRentCollected: number;
    rawCalculatedFee: number;
    finalMonthlyFee: number;
    subscriptionTier: string;
}

export async function calculateAllFees({ billingPeriod }: { billingPeriod: string }): Promise<FeeCalculationResult[]> {
  const periodDate = new Date(billingPeriod + '-02'); // Use day 2 to avoid timezone issues
  
  // Use string-based dates for querying as per data model
  const startDate = format(startOfMonth(periodDate), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(periodDate), 'yyyy-MM-dd');

  // 1. Get all landlords
  const landlordsSnap = await db.collection('users').where('role', '==', 'landlord').get();
  const landlords = landlordsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const results: FeeCalculationResult[] = [];

  for (const landlord of landlords) {
    
    // --- Get per-user billing config, or fall back to defaults ---
    const userBillingConfig = landlord.billing || {};
    const subscriptionTier = userBillingConfig.subscriptionTier || 'free';
    const pct = userBillingConfig.transactionFeePercent ?? DEFAULT_PCT;
    const unitCap = userBillingConfig.unitCap ?? DEFAULT_UNIT_CAP;
    const minFee = userBillingConfig.minFee ?? DEFAULT_MIN_FEE;

    // Skip free/trial users from fee calculation, but still include them in the report
    if (subscriptionTier === 'free' || subscriptionTier === 'trialing') {
        results.push({
          userId: landlord.id,
          userEmail: landlord.email,
          activeUnits: 0,
          totalRentCollected: 0,
          rawCalculatedFee: 0,
          finalMonthlyFee: 0,
          subscriptionTier: subscriptionTier,
        });
        continue;
    }

    // 2. Fetch all of the landlord's rent transactions for the period
    const transactionsSnap = await db.collectionGroup('transactions')
      .where('userId', '==', landlord.id)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .where('categoryHierarchy.l0', '==', 'INCOME')
      .where('categoryHierarchy.l1', '==', 'Rental Income')
      .get();
      
    const rentTransactions = transactionsSnap.docs.map(doc => doc.data());

    if (rentTransactions.length === 0) {
      // If no income, the raw fee is 0, but the minimum still applies for paying customers.
      results.push({
          userId: landlord.id,
          userEmail: landlord.email,
          activeUnits: 0,
          totalRentCollected: 0,
          rawCalculatedFee: 0,
          finalMonthlyFee: minFee, 
          subscriptionTier: subscriptionTier,
      });
      continue;
    }
    
    // 3. Group rent collected by the correct space identifier (unitId or propertyId)
    const rentBySpace = new Map<string, number>();
    rentTransactions.forEach(tx => {
      // A "space" is a unit if specified, otherwise it's the property itself.
      const spaceId = tx.unitId || tx.propertyId;
      if (spaceId && tx.amount > 0) {
        const currentAmount = rentBySpace.get(spaceId) || 0;
        rentBySpace.set(spaceId, currentAmount + tx.amount);
      }
    });

    if (rentBySpace.size === 0) {
        results.push({
            userId: landlord.id,
            userEmail: landlord.email,
            activeUnits: 0,
            totalRentCollected: 0,
            rawCalculatedFee: 0,
            finalMonthlyFee: minFee,
            subscriptionTier: subscriptionTier,
        });
        continue;
    }

    // 4. Calculate the fee based on the rules (user-specific or default)
    let rawMonthlyFee = 0;
    let totalRentCollected = 0;
    
    for (const [spaceId, collectedRent] of rentBySpace.entries()) {
      totalRentCollected += collectedRent;
      const spacePercentFee = collectedRent * pct;
      const spaceFee = Math.min(spacePercentFee, unitCap); // Apply per-unit cap
      rawMonthlyFee += spaceFee;
    }

    const finalMonthlyFee = Math.max(rawMonthlyFee, minFee); // Apply minimum
    
    // Round to 2 decimal places
    const roundedFinalFee = Math.round(finalMonthlyFee * 100) / 100;
    const roundedRawFee = Math.round(rawMonthlyFee * 100) / 100;
    
    results.push({
      userId: landlord.id,
      userEmail: landlord.email,
      activeUnits: rentBySpace.size,
      totalRentCollected: Math.round(totalRentCollected * 100) / 100,
      rawCalculatedFee: roundedRawFee,
      finalMonthlyFee: roundedFinalFee,
      subscriptionTier: subscriptionTier,
    });
  }

  return results.sort((a, b) => b.finalMonthlyFee - a.finalMonthlyFee);
}
