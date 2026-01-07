
'use server';

import { db } from '@/lib/admin-db';
import { calculateAmortization } from './amortization-actions';
import { eachMonthOfInterval, parseISO } from 'date-fns';

interface ReportParams {
    userId: string;
    startDate: string;
    endDate: string;
    propertyId?: string; // 'all' or a specific ID
}

// --- 1. SCHEDULE E SUMMARY ---
export async function getScheduleESummary({ userId, startDate, endDate, propertyId }: ReportParams) {
    const transactions = await getFilteredTransactions(userId, startDate, endDate, propertyId);
    
    const summary: Record<string, { total: number }> = {};

    transactions.forEach((tx: any) => {
        const l0 = tx.categoryHierarchy?.l0?.toUpperCase() || '';
        if (l0 !== 'INCOME' && l0 !== 'EXPENSE' && l0 !== 'OPERATING EXPENSE') {
            return; // Skip non-operational transactions
        }
        
        const category = tx.categoryHierarchy?.l2 || 'Uncategorized';
        if (!summary[category]) {
            summary[category] = { total: 0 };
        }
        summary[category].total += tx.amount;
    });

    return Object.entries(summary).map(([category, data]) => ({
        category,
        amount: data.total
    })).sort((a,b) => a.category.localeCompare(b.category));
}


// --- 2. DEPRECIATION SCHEDULE ---
export async function getDepreciationSchedule({ userId, propertyId }: ReportParams) {
    let q = db.collection('properties').where('userId', '==', userId);
    if (propertyId && propertyId !== 'all') {
        q = q.where('id', '==', propertyId);
    }
    
    const snap = await q.get();
    const properties = snap.docs.map(doc => doc.data());

    return properties.map(p => {
        const basis = (p.depreciation?.purchasePrice || 0) - (p.depreciation?.landValue || 0) + (p.depreciation?.closingCosts || 0);
        const annualDep = p.depreciation?.usefulLife > 0 ? basis / p.depreciation.usefulLife : 0;
        return {
            property: p.name,
            inServiceDate: p.depreciation?.inServiceDate || 'N/A',
            basis: basis,
            method: p.depreciation?.method || 'SL',
            usefulLife: p.depreciation?.usefulLife || 0,
            annualDepreciation: annualDep,
        }
    });
}

// --- 3. MORTGAGE INTEREST SUMMARY (CORRECTED LOGIC) ---
export async function getMortgageInterestSummary({ userId, startDate, endDate, propertyId }: ReportParams) {
    
    // 1. Fetch all properties for the user to calculate interest for all of them
    const allPropertiesSnap = await db.collection('properties').where('userId', '==', userId).get();
    // **FIX**: Map both the data AND the document ID
    const allProperties = allPropertiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const summary: Record<string, { property: string; amount: number; lender: string }> = {};

    const months = eachMonthOfInterval({ start: parseISO(startDate), end: parseISO(endDate) });

    for (const prop of allProperties) {
        if (prop.mortgage?.hasMortgage === 'yes' && prop.mortgage.originalLoanAmount) {
            let totalInterestForProperty = 0;
            
            for (const monthDate of months) {
                const result = await calculateAmortization({
                    principal: prop.mortgage.originalLoanAmount,
                    annualRate: prop.mortgage.interestRate,
                    principalAndInterest: prop.mortgage.principalAndInterest,
                    loanStartDate: prop.mortgage.purchaseDate,
                    loanTermInYears: prop.mortgage.loanTerm,
                    targetDate: monthDate.toISOString(),
                });
                if (result.success && result.interestPaidForMonth) {
                    totalInterestForProperty += result.interestPaidForMonth;
                }
            }

            if (totalInterestForProperty > 0) {
                 if (!summary[prop.id]) {
                    summary[prop.id] = { property: prop.name, amount: 0, lender: prop.mortgage.lenderName || 'N/A' };
                }
                summary[prop.id].amount += totalInterestForProperty;
            }
        }
    }

    // Convert to array
    const fullReport = Object.values(summary);

    // If a specific property was requested, filter the final result
    if (propertyId && propertyId !== 'all') {
        const specificProperty = allProperties.find(p => p.id === propertyId);
        if (!specificProperty) return [];
        return fullReport.filter(item => item.property === specificProperty.name);
    }
    
    return fullReport;
}


// --- 4. GENERAL LEDGER (CPA) ---
export async function getGeneralLedger({ userId, startDate, endDate, propertyId }: ReportParams) {
    const transactions = await getFilteredTransactions(userId, startDate, endDate, propertyId);
    
    return transactions
      .filter((tx: any) => !tx.categoryHierarchy?.l1?.toLowerCase().includes('transfer'))
      .map((tx: any) => ({
        date: tx.date,
        description: tx.description,
        category: `${tx.categoryHierarchy?.l1 || ''} > ${tx.categoryHierarchy?.l2 || ''}`,
        amount: tx.amount,
      }))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// --- 5. EQUITY ROLL-FORWARD ---
export async function getEquityRollForward({ userId, startDate, endDate, propertyId }: ReportParams) {
    const transactions = await getFilteredTransactions(userId, startDate, endDate, propertyId);

    const contributions = transactions
        .filter((tx: any) => tx.categoryHierarchy?.l1?.toLowerCase().includes('owner contributions'))
        .reduce((sum: any, tx: any) => sum + tx.amount, 0);

    const distributions = transactions
        .filter((tx: any) => tx.categoryHierarchy?.l1?.toLowerCase().includes('owner distributions'))
        .reduce((sum: any, tx: any) => sum + tx.amount, 0);
    
    // For net income, we need all income and expenses
    const income = transactions.filter((tx: any) => tx.categoryHierarchy?.l0 === 'Income').reduce((sum: any, tx: any) => sum + tx.amount, 0);
    const expense = transactions.filter((tx: any) => tx.categoryHierarchy?.l0?.includes('Expense')).reduce((sum: any, tx: any) => sum + tx.amount, 0);
    const netIncome = income + expense;

    return [
        { item: 'Beginning Equity Balance', amount: 0 }, // Placeholder - needs prior balance
        { item: 'Owner Contributions', amount: contributions },
        { item: 'Owner Distributions', amount: distributions },
        { item: 'Net Income for Period', amount: netIncome },
        { item: 'Ending Equity Balance', amount: 0 + contributions + distributions + netIncome },
    ];
}


// --- HELPER FUNCTION ---
async function getFilteredTransactions(userId: string, startDate: string, endDate: string, propertyId?: string) {
    let txQuery = db.collectionGroup('transactions')
        .where('userId', '==', userId)
        .where('date', '>=', startDate)
        .where('date', '<=', endDate);

    if (propertyId && propertyId !== 'all') {
        txQuery = txQuery.where('costCenter', '==', propertyId);
    }

    const snap = await txQuery.get();
    return snap.docs.map(doc => doc.data() as any);
}
