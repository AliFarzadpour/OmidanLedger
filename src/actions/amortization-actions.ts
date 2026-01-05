
'use server';

import { differenceInCalendarMonths, startOfMonth, endOfMonth, getDay } from 'date-fns';

interface AmortizationInput {
    principal: number;
    annualRate: number;
    principalAndInterest: number; // Use the actual P&I payment
    loanStartDate: string;
    targetDate: string; // The date for which we want the balance and interest
}

interface AmortizationResult {
    success: boolean;
    currentBalance?: number;
    interestPaidForMonth?: number;
    error?: string;
}

/**
 * Calculates the loan balance at the end of a specific month and the interest paid during that month.
 */
export async function calculateAmortization({
    principal,
    annualRate,
    principalAndInterest,
    loanStartDate,
    targetDate,
}: AmortizationInput): Promise<AmortizationResult> {

    if (!principal || !annualRate || !principalAndInterest || !loanStartDate || !targetDate) {
        return { success: false, error: 'Missing required amortization parameters.' };
    }

    try {
        const monthlyRate = annualRate / 100 / 12;
        
        const loanStart = startOfMonth(new Date(loanStartDate));
        const target = startOfMonth(new Date(targetDate));

        // Calculate the number of full months passed *before* the target month
        let monthsPassed = differenceInCalendarMonths(target, loanStart);

        if (monthsPassed < 0) {
            // If target date is before loan start, balance is the original principal
            return { success: true, currentBalance: principal, interestPaidForMonth: 0 };
        }

        let balanceAtStartOfMonth = principal;

        // Loop to find the balance at the beginning of the target month
        for (let i = 0; i < monthsPassed; i++) {
            const interestPayment = balanceAtStartOfMonth * monthlyRate;
            const principalPayment = principalAndInterest - interestPayment;
            
            if (principalPayment > 0) {
              balanceAtStartOfMonth -= principalPayment;
            }
        }

        // Now, calculate the single month's interest and the end-of-month balance
        const interestForMonth = balanceAtStartOfMonth * monthlyRate;
        const principalForMonth = principalAndInterest - interestForMonth;
        const balanceAtEndOfMonth = balanceAtStartOfMonth - (principalForMonth > 0 ? principalForMonth : 0);

        return {
            success: true,
            currentBalance: Math.max(0, parseFloat(balanceAtEndOfMonth.toFixed(2))),
            interestPaidForMonth: Math.max(0, parseFloat(interestForMonth.toFixed(2))),
        };

    } catch (error: any) {
        console.error("Amortization calculation error:", error);
        return { success: false, error: error.message || 'Failed to calculate loan balance.' };
    }
}
