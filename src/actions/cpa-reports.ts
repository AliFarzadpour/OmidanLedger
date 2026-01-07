'use server';

import { db } from '@/lib/admin-db';
import { collectionGroup, getDocs, query, where } from 'firebase-admin/firestore';
import { calculateAmortization } from './amortization-actions';

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

    transactions.forEach(tx => {
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
    let q = query(collectionGroup(db, 'properties'), where('userId', '==', userId));
    if (propertyId && propertyId !== 'all') {
        q = query(q, where('id', '==', propertyId));
    }
    
    const snap = await getDocs(q);
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

// --- 3. MORTGAGE INTEREST SUMMARY ---
export async function getMortgageInterestSummary({ userId, startDate, endDate, propertyId }: ReportParams) {
     const transactions = await getFilteredTransactions(userId, startDate, endDate, propertyId);

    const interestPayments = transactions.filter(tx => 
        tx.categoryHierarchy?.l2?.toLowerCase().includes('mortgage interest')
    );

    const summary: Record<string, { lender: string; total: number }> = {};

    interestPayments.forEach(tx => {
        const propertyName = tx.costCenter || 'Unknown Property';
         if (!summary[propertyName]) {
            summary[propertyName] = { lender: 'Unknown Lender', total: 0 };
        }
        summary[propertyName].total += Math.abs(tx.amount);
    });

    return Object.entries(summary).map(([property, data]) => ({
        property,
        amount: data.total
    }));
}


// --- 4. GENERAL LEDGER (CPA) ---
export async function getGeneralLedger({ userId, startDate, endDate, propertyId }: ReportParams) {
    const transactions = await getFilteredTransactions(userId, startDate, endDate, propertyId);
    
    return transactions
      .filter(tx => !tx.categoryHierarchy?.l1?.toLowerCase().includes('transfer'))
      .map(tx => ({
        date: tx.date,
        description: tx.description,
        category: `${tx.categoryHierarchy?.l1 || ''} > ${tx.categoryHierarchy?.l2 || ''}`,
        amount: tx.amount,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// --- 5. EQUITY ROLL-FORWARD ---
export async function getEquityRollForward({ userId, startDate, endDate, propertyId }: ReportParams) {
    const transactions = await getFilteredTransactions(userId, startDate, endDate, propertyId);

    const contributions = transactions
        .filter(tx => tx.categoryHierarchy?.l1?.toLowerCase().includes('owner contributions'))
        .reduce((sum, tx) => sum + tx.amount, 0);

    const distributions = transactions
        .filter(tx => tx.categoryHierarchy?.l1?.toLowerCase().includes('owner distributions'))
        .reduce((sum, tx) => sum + tx.amount, 0);
    
    // For net income, we need all income and expenses
    const income = transactions.filter(tx => tx.categoryHierarchy?.l0 === 'Income').reduce((sum, tx) => sum + tx.amount, 0);
    const expense = transactions.filter(tx => tx.categoryHierarchy?.l0?.includes('Expense')).reduce((sum, tx) => sum + tx.amount, 0);
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
    let txQuery = query(
        collectionGroup(db, 'transactions'),
        where('userId', '==', userId),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
    );

    if (propertyId && propertyId !== 'all') {
        txQuery = query(txQuery, where('costCenter', '==', propertyId));
    }

    const snap = await getDocs(txQuery);
    return snap.docs.map(doc => doc.data() as any);
}
