
'use server';

import { startOfMonth } from 'date-fns';

interface AmortizationInput {
    principal: number;
    annualRate: number;
    principalAndInterest: number;
    loanStartDate: string;
    targetDate: string;
}

interface AmortizationResult {
    success: boolean;
    currentBalance?: number;
    interestPaidForMonth?: number;
    error?: string;
}

/**
 * Calculates the loan balance at the end of a specific month and the interest paid during that month.
 * This version iterates month-by-month for higher accuracy.
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
        
        let currentDate = startOfMonth(new Date(loanStartDate));
        const target = startOfMonth(new Date(targetDate));
        
        if (target < currentDate) {
             return { success: true, currentBalance: principal, interestPaidForMonth: 0 };
        }

        let balance = principal;

        // Loop through each month from the start of the loan up to the month *before* the target month.
        while (currentDate < target) {
            const interest = balance * monthlyRate;
            const principalPayment = principalAndInterest - interest;
            
            if (balance - principalPayment < 0) {
                balance = 0;
                break;
            }
            balance -= principalPayment;
            
            // Move to the next month
            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        // Now, `balance` is the balance at the START of the target month.
        // Calculate the interest for this specific month.
        const interestForMonth = balance * monthlyRate;
        const principalForMonth = principalAndInterest - interestForMonth;
        
        // The final balance at the END of the target month.
        const balanceAtEndOfMonth = balance - (principalForMonth > 0 ? principalForMonth : 0);

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
