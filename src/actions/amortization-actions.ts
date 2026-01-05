
'use server';

import { differenceInCalendarMonths } from 'date-fns';

interface AmortizationInput {
    principal: number;
    annualRate: number;
    principalAndInterest: number; // Use the actual P&I payment
    startDate: string;
}

interface AmortizationResult {
    success: boolean;
    currentBalance?: number;
    error?: string;
}

/**
 * Calculates the current loan balance based on an amortization schedule.
 */
export async function calculateAmortization({
    principal,
    annualRate,
    principalAndInterest,
    startDate
}: AmortizationInput): Promise<AmortizationResult> {

    if (!principal || !annualRate || !principalAndInterest || !startDate) {
        return { success: false, error: 'Missing required amortization parameters (Principal, Rate, P&I, Start Date).' };
    }

    try {
        const monthlyRate = annualRate / 100 / 12;
        
        const start = new Date(startDate);
        const now = new Date();
        
        // Use a more reliable method to count full months passed.
        const monthsPassed = differenceInCalendarMonths(now, start);
        
        if (monthsPassed <= 0) {
            return { success: true, currentBalance: principal };
        }

        let currentBalance = principal;

        for (let i = 0; i < monthsPassed; i++) {
            const interestPayment = currentBalance * monthlyRate;
            const principalPayment = principalAndInterest - interestPayment;
            currentBalance -= principalPayment;
        }
        
        // Ensure balance is not negative and round to 2 decimal places
        const finalBalance = Math.max(0, currentBalance);

        return { success: true, currentBalance: parseFloat(finalBalance.toFixed(2)) };

    } catch (error: any) {
        console.error("Amortization calculation error:", error);
        return { success: false, error: error.message || 'Failed to calculate loan balance.' };
    }
}
