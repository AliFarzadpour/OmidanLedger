
'use server';

import { differenceInCalendarMonths, getDay, isAfter, startOfDay } from 'date-fns';

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
        
        const loanStartDate = startOfDay(new Date(startDate));
        const today = startOfDay(new Date());

        // --- REFINED MONTH COUNTING LOGIC ---
        // 1. Get the base number of calendar months passed.
        let monthsPassed = differenceInCalendarMonths(today, loanStartDate);

        // 2. Adjust if the current month's payment hasn't been made yet.
        // If today's day of the month is *before* the loan's start day,
        // it implies this calendar month's payment cycle isn't complete yet.
        if (getDay(today) < getDay(loanStartDate)) {
            monthsPassed -= 1;
        }
        
        if (monthsPassed <= 0) {
            return { success: true, currentBalance: principal };
        }

        let currentBalance = principal;

        for (let i = 0; i < monthsPassed; i++) {
            const interestPayment = currentBalance * monthlyRate;
            const principalPayment = principalAndInterest - interestPayment;
            
            // Safety check: if interest is more than payment, principal doesn't go down
            if (principalPayment > 0) {
              currentBalance -= principalPayment;
            }
        }
        
        // Ensure balance is not negative and round to 2 decimal places
        const finalBalance = Math.max(0, currentBalance);

        return { success: true, currentBalance: parseFloat(finalBalance.toFixed(2)) };

    } catch (error: any) {
        console.error("Amortization calculation error:", error);
        return { success: false, error: error.message || 'Failed to calculate loan balance.' };
    }
}
