
'use server';

import { db } from '@/lib/admin-db';
import { startOfMonth, endOfMonth, format } from 'date-fns';

const PCT = 0.0075;
const UNIT_CAP = 30.00;
const MIN_FEE = 29.00;

export interface FeeCalculationResult {
    userId: string;
    userEmail: string;
    activeUnits: number;
    totalRentCollected: number;
    rawMonthlyFee: number;
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
    
    // Skip free/trial users from fee calculation, but still include them in the report
    const subscriptionTier = landlord.billing?.subscriptionTier || 'free';
    if (subscriptionTier === 'free' || subscriptionTier === 'trialing') {
        results.push({
          userId: landlord.id,
          userEmail: landlord.email,
          activeUnits: 0,
          totalRentCollected: 0,
          rawMonthlyFee: 0,
          finalMonthlyFee: 0,
          subscriptionTier: subscriptionTier,
        });
        continue;
    }

    // 2. For each landlord, get all their income transactions for the period
    const transactionsSnap = await db.collectionGroup('transactions')
      .where('userId', '==', landlord.id)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();
      
    const incomeTransactions = transactionsSnap.docs
        .map(doc => doc.data())
        .filter(tx => tx.categoryHierarchy?.l0 === 'Income' && tx.categoryHierarchy?.l1 === 'Rental Income');

    if (incomeTransactions.length === 0) {
      // If no income, the raw fee is 0, but the minimum still applies.
      results.push({
          userId: landlord.id,
          userEmail: landlord.email,
          activeUnits: 0,
          totalRentCollected: 0,
          rawMonthlyFee: 0,
          finalMonthlyFee: MIN_FEE,
          subscriptionTier: subscriptionTier,
      });
      continue;
    }
    
    // 3. Group collected rent by unit (costCenter)
    const unitPayments = new Map<string, number>();
    incomeTransactions.forEach(tx => {
      if (tx.costCenter && tx.amount > 0) {
        const currentAmount = unitPayments.get(tx.costCenter) || 0;
        unitPayments.set(tx.costCenter, currentAmount + tx.amount);
      }
    });

    if (unitPayments.size === 0) {
        results.push({
            userId: landlord.id,
            userEmail: landlord.email,
            activeUnits: 0,
            totalRentCollected: 0,
            rawMonthlyFee: 0,
            finalMonthlyFee: MIN_FEE,
            subscriptionTier: subscriptionTier,
        });
        continue;
    }

    // 4. Calculate the fee based on the rules
    let rawMonthlyFee = 0;
    let totalRentCollected = 0;

    for (const [unitId, collectedRent] of unitPayments.entries()) {
      totalRentCollected += collectedRent;
      const unitPercentFee = collectedRent * PCT;
      const unitFee = Math.min(unitPercentFee, UNIT_CAP);
      rawMonthlyFee += unitFee;
    }

    const finalMonthlyFee = Math.max(rawMonthlyFee, MIN_FEE);
    
    // Round to 2 decimal places
    const roundedFinalFee = Math.round(finalMonthlyFee * 100) / 100;
    const roundedRawFee = Math.round(rawMonthlyFee * 100) / 100;
    
    results.push({
      userId: landlord.id,
      userEmail: landlord.email,
      activeUnits: unitPayments.size,
      totalRentCollected: totalRentCollected,
      rawMonthlyFee: roundedRawFee,
      finalMonthlyFee: roundedFinalFee,
      subscriptionTier: subscriptionTier,
    });
  }

  return results.sort((a, b) => b.finalMonthlyFee - a.finalMonthlyFee);
}
