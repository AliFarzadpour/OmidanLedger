
'use server';

import { db } from '@/lib/admin-db';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { Timestamp } from 'firebase-admin/firestore';

// --- SYSTEM DEFAULTS ---
const DEFAULT_PCT = 0.0075;
const DEFAULT_UNIT_CAP = 30.00;
const DEFAULT_MIN_FEE = 29.00;

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
  const periodDate = new Date(billingPeriod + '-02'); // Use day 2 to avoid timezone issues
  
  // Use Timestamps for querying
  const startTs = Timestamp.fromDate(startOfMonth(periodDate));
  const endTs = Timestamp.fromDate(endOfMonth(periodDate));

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
          rawMonthlyFee: 0,
          finalMonthlyFee: 0,
          subscriptionTier: subscriptionTier,
        });
        continue;
    }

    // 2. Fetch all landlord's properties to get their units
    const propertiesSnap = await db.collection('properties').where('userId', '==', landlord.id).get();
    if (propertiesSnap.empty) {
        // If no properties, apply minimum fee for paying customers
         results.push({
            userId: landlord.id,
            userEmail: landlord.email,
            activeUnits: 0,
            totalRentCollected: 0,
            rawMonthlyFee: 0,
            finalMonthlyFee: minFee,
            subscriptionTier: subscriptionTier,
        });
        continue;
    }

    const unitSnaps = await Promise.all(
        propertiesSnap.docs.map(propDoc => db.collection('properties').doc(propDoc.id).collection('units').get())
    );

    // Build a comprehensive Set of all possible unit identifiers
    const unitKeySet = new Set<string>();
    unitSnaps.forEach(snap => {
      snap.docs.forEach(d => {
        const data = d.data() as any;
        unitKeySet.add(d.id); // Firestore doc ID
        if (data.unitId) unitKeySet.add(String(data.unitId));
        if (data.unitNumber) unitKeySet.add(String(data.unitNumber));
        if (data.name) unitKeySet.add(String(data.name));
        if (data.label) unitKeySet.add(String(data.label));
        if (data.propertyId) unitKeySet.add(`${data.propertyId}:${d.id}`);
      });
    });

    // 3. For each landlord, get all their income transactions for the period
    const transactionsSnap = await db.collectionGroup('transactions')
      .where('userId', '==', landlord.id)
      .where('date', '>=', startOfMonth(periodDate).toISOString().split('T')[0])
      .where('date', '<=', endOfMonth(periodDate).toISOString().split('T')[0])
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
          finalMonthlyFee: minFee, // Apply the user-specific or default minimum
          subscriptionTier: subscriptionTier,
      });
      continue;
    }
    
    // 4. Group collected rent by unit (costCenter)
    const unitPayments = new Map<string, number>();
    incomeTransactions.forEach(tx => {
      if (tx.costCenter && tx.amount > 0) {
        const key = String(tx.costCenter);
        // Only count payments that are associated with a known unit
        if (unitKeySet.has(key)) {
            const currentAmount = unitPayments.get(key) || 0;
            unitPayments.set(key, currentAmount + tx.amount);
        }
      }
    });

    if (unitPayments.size === 0) {
        results.push({
            userId: landlord.id,
            userEmail: landlord.email,
            activeUnits: 0,
            totalRentCollected: 0,
            rawMonthlyFee: 0,
            finalMonthlyFee: minFee, // Apply the user-specific or default minimum
            subscriptionTier: subscriptionTier,
        });
        continue;
    }

    // 5. Calculate the fee based on the rules (user-specific or default)
    let rawMonthlyFee = 0;
    let totalRentCollected = 0;

    for (const [unitId, collectedRent] of unitPayments.entries()) {
      totalRentCollected += collectedRent;
      const unitPercentFee = collectedRent * pct;
      const unitFee = Math.min(unitPercentFee, unitCap); // Use user-specific cap
      rawMonthlyFee += unitFee;
    }

    const finalMonthlyFee = Math.max(rawMonthlyFee, minFee); // Use user-specific minimum
    
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
