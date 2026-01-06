
'use server';

import { db } from '@/lib/admin-db';
import { startOfMonth, endOfMonth, format } from 'date-fns';

// --- SYSTEM DEFAULTS & PRICING RULES ---
const DEFAULT_PCT = 0.0075;
const DEFAULT_UNIT_CAP = 30.00;
const DEFAULT_MIN_FEE = 29.00;

interface FeeBreakdownItem {
    spaceId: string;
    spaceName: string;
    collectedRent: number;
    fee: number;
}

export interface FeeCalculationResult {
    userId: string;
    userEmail: string;
    activeUnits: number;
    totalRentCollected: number;
    rawMonthlyFee: number;
    finalMonthlyFee: number;
    subscriptionTier: string;
    breakdown: FeeBreakdownItem[];
}

export async function calculateAllFees({ billingPeriod }: { billingPeriod: string }): Promise<FeeCalculationResult[]> {
  const periodDate = new Date(billingPeriod + '-02'); 
  const startDate = format(startOfMonth(periodDate), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(periodDate), 'yyyy-MM-dd');

  const landlordsSnap = await db.collection('users').where('role', '==', 'landlord').get();
  const landlords = landlordsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const results: FeeCalculationResult[] = [];

  for (const landlord of landlords) {
    const userBillingConfig = landlord.billing || {};
    const subscriptionTier = userBillingConfig.subscriptionTier || 'free';
    
    if (subscriptionTier === 'free' || subscriptionTier === 'trialing') {
        results.push({
          userId: landlord.id,
          userEmail: landlord.email,
          activeUnits: 0,
          totalRentCollected: 0,
          rawMonthlyFee: 0,
          finalMonthlyFee: 0,
          subscriptionTier: subscriptionTier,
          breakdown: [],
        });
        continue;
    }
    
    const pctRaw = userBillingConfig.transactionFeePercent ?? DEFAULT_PCT;
    const pct = Number(pctRaw) > 0.2 ? Number(pctRaw) / 100 : Number(pctRaw);
    const unitCap = Number(userBillingConfig.unitCap ?? DEFAULT_UNIT_CAP);
    const minFee = Number(userBillingConfig.minFee ?? DEFAULT_MIN_FEE);

    const rentTransactionsSnap = await db.collectionGroup('transactions')
      .where('userId', '==', landlord.id)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .where('categoryHierarchy.l0', '==', 'INCOME')
      .where('categoryHierarchy.l1', '==', 'Rental Income')
      .get();
    
    const rentTransactions = rentTransactionsSnap.docs.map(doc => doc.data());
    
    const rentBySpace = new Map<string, { name: string; collectedRent: number }>();
    const propertiesSnap = await db.collection('properties').where('userId', '==', landlord.id).get();
    
    for (const propDoc of propertiesSnap.docs) {
        const property = propDoc.data();
        const propertyId = propDoc.id;

        if (property.isMultiUnit || property.type === 'multi-family' || property.type === 'commercial' || property.type === 'office') {
            const unitsSnap = await propDoc.ref.collection('units').get();
            let matchedAnyUnit = false;
            if (!unitsSnap.empty) {
                unitsSnap.docs.forEach(unitDoc => {
                    const unitId = unitDoc.id;
                    const unitData = unitDoc.data();
                    
                    const unitRent = rentTransactions
                        .filter(tx => tx.unitId === unitId || tx.costCenter === unitId)
                        .reduce((sum, tx) => sum + tx.amount, 0);

                    if (unitRent > 0) {
                        matchedAnyUnit = true;
                        const current = rentBySpace.get(unitId) || { name: `${property.name} #${unitData.unitNumber}`, collectedRent: 0 };
                        current.collectedRent += unitRent;
                        rentBySpace.set(unitId, current);
                    }
                });
            }

            if (!matchedAnyUnit) {
                const propertyRent = rentTransactions
                  .filter((tx: any) => tx.propertyId === propertyId || tx.costCenter === propertyId)
                  .reduce((sum: number, tx: any) => sum + Number(tx.amount ?? 0), 0);
          
                if (propertyRent > 0) {
                  rentBySpace.set(propertyId, { name: property.name, collectedRent: propertyRent });
                }
            }

        } else { 
            const propertyRent = rentTransactions
                .filter(tx => tx.costCenter === propertyId || tx.propertyId === propertyId)
                .reduce((sum, tx) => sum + tx.amount, 0);
            
            if (propertyRent > 0) {
                const current = rentBySpace.get(propertyId) || { name: property.name, collectedRent: 0 };
                current.collectedRent += propertyRent;
                rentBySpace.set(propertyId, current);
            }
        }
    }
    
    let unassignedRent = 0;
    rentTransactions.forEach(tx => {
        if (!tx.costCenter && !tx.unitId && !tx.propertyId) {
            unassignedRent += tx.amount;
        }
    });
    if (unassignedRent > 0) {
         if (!rentBySpace.has('unassigned')) {
            rentBySpace.set('unassigned', { name: 'Unassigned Properties', collectedRent: 0 });
        }
        rentBySpace.get('unassigned')!.collectedRent += unassignedRent;
    }

    if (rentBySpace.size === 0) {
        results.push({
            userId: landlord.id,
            userEmail: landlord.email,
            activeUnits: 0,
            totalRentCollected: 0,
            rawMonthlyFee: 0,
            finalMonthlyFee: minFee,
            subscriptionTier: subscriptionTier,
            breakdown: [],
        });
        continue;
    }

    let rawCalculatedFee = 0;
    let totalRentCollected = 0;
    const breakdown: FeeBreakdownItem[] = [];
    
    for (const [spaceId, spaceData] of rentBySpace.entries()) {
      totalRentCollected += spaceData.collectedRent;
      
      const percentageBasedFee = spaceData.collectedRent * pct;
      const spaceFee = percentageBasedFee > unitCap ? unitCap : percentageBasedFee;
      
      rawCalculatedFee += spaceFee; 

      breakdown.push({
          spaceId,
          spaceName: spaceData.name,
          collectedRent: spaceData.collectedRent,
          fee: spaceFee,
      });
    }

    const finalMonthlyFee = Math.max(rawCalculatedFee, minFee);
    
    results.push({
      userId: landlord.id,
      userEmail: landlord.email,
      activeUnits: rentBySpace.size,
      totalRentCollected: Number(totalRentCollected.toFixed(2)),
      rawMonthlyFee: Number(rawCalculatedFee.toFixed(2)),
      finalMonthlyFee: Number(finalMonthlyFee.toFixed(2)),
      subscriptionTier: subscriptionTier,
      breakdown,
    });
  }

  return results.sort((a, b) => b.finalMonthlyFee - a.finalMonthlyFee);
}
