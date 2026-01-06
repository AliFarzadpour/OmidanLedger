
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
  const periodDate = new Date(billingPeriod + '-02'); 
  const startDate = format(startOfMonth(periodDate), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(periodDate), 'yyyy-MM-dd');

  // 1. Get all landlords
  const landlordsSnap = await db.collection('users').where('role', '==', 'landlord').get();
  const landlords = landlordsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const results: FeeCalculationResult[] = [];

  for (const landlord of landlords) {
    const userBillingConfig = landlord.billing || {};
    const subscriptionTier = userBillingConfig.subscriptionTier || 'free';
    const pct = userBillingConfig.transactionFeePercent ?? DEFAULT_PCT;
    const unitCap = userBillingConfig.unitCap ?? DEFAULT_UNIT_CAP;
    const minFee = userBillingConfig.minFee ?? DEFAULT_MIN_FEE;

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

    // Fetch all rent transactions for the landlord for the entire month
    const transactionsSnap = await db.collectionGroup('transactions')
      .where('userId', '==', landlord.id)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .where('categoryHierarchy.l0', '==', 'INCOME')
      .where('categoryHierarchy.l1', '==', 'Rental Income')
      .get();
    
    const rentTransactions = transactionsSnap.docs.map(doc => doc.data());

    if (rentTransactions.length === 0) {
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

    const rentBySpace = new Map<string, number>();

    // Fetch all properties for the landlord
    const propertiesSnap = await db.collection('properties').where('userId', '==', landlord.id).get();
    
    for (const propDoc of propertiesSnap.docs) {
        const property = propDoc.data();
        const propertyId = propDoc.id;

        // If it's a multi-unit property, we need to check each unit
        if (property.type === 'multi-family' || property.type === 'commercial' || property.type === 'office') {
            const unitsSnap = await propDoc.ref.collection('units').get();
            if (!unitsSnap.empty) {
                unitsSnap.docs.forEach(unitDoc => {
                    const unitId = unitDoc.id;
                    const unitRent = rentTransactions
                        .filter(tx => tx.costCenter === unitId)
                        .reduce((sum, tx) => sum + tx.amount, 0);

                    if (unitRent > 0) {
                        rentBySpace.set(unitId, (rentBySpace.get(unitId) || 0) + unitRent);
                    }
                });
            }
        } else {
            // For single-family, the property itself is the space
            const propertyRent = rentTransactions
                .filter(tx => tx.costCenter === propertyId)
                .reduce((sum, tx) => sum + tx.amount, 0);
            
            if (propertyRent > 0) {
                rentBySpace.set(propertyId, (rentBySpace.get(propertyId) || 0) + propertyRent);
            }
        }
    }


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

    let rawMonthlyFee = 0;
    let totalRentCollected = 0;
    
    for (const [spaceId, collectedRent] of rentBySpace.entries()) {
      totalRentCollected += collectedRent;
      const spacePercentFee = collectedRent * pct;
      const spaceFee = Math.min(spacePercentFee, unitCap);
      rawMonthlyFee += spaceFee;
    }

    const finalMonthlyFee = Math.max(rawMonthlyFee, minFee);
    
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
