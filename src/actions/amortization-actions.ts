
'use server';

import { startOfMonth, addMonths, isBefore, differenceInMonths } from 'date-fns';

interface AmortizationInput {
    principal: number;
    annualRate: number;
    principalAndInterest: number;
    loanStartDate: string; // YYYY-MM-DD
    loanTermInYears: number;
    targetDate: string; // YYYY-MM-DD
}

interface AmortizationResult {
    success: boolean;
    currentBalance?: number;
    interestPaidForMonth?: number;
    remainingTermInMonths?: number;
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
    loanTermInYears,
    targetDate,
}: AmortizationInput): Promise<AmortizationResult> {

    if (!principal || !annualRate || !principalAndInterest || !loanStartDate || !targetDate || !loanTermInYears) {
        return { success: false, error: 'Missing required amortization parameters.' };
    }

    try {
        const monthlyRate = annualRate / 100 / 12;
        const originalTermInMonths = loanTermInYears * 12;
        
        // Use start of month for both dates for consistent comparison
        const startOfLoanMonth = startOfMonth(new Date(loanStartDate));
        const startOfTargetMonth = startOfMonth(new Date(targetDate));

        // If the target month is before or the same as the loan start month, no payments have been made.
        if (!isBefore(startOfLoanMonth, startOfTargetMonth)) {
             return { 
                 success: true, 
                 currentBalance: principal, 
                 interestPaidForMonth: 0, 
                 remainingTermInMonths: originalTermInMonths 
            };
        }

        let balance = principal;
        
        // A payment is typically made on the 1st of the month *following* the loan start.
        // E.g., a loan starting on Oct 13 has its first payment on Nov 1.
        const firstPaymentDate = addMonths(startOfLoanMonth, 1);
        const paymentsMade = differenceInMonths(startOfTargetMonth, firstPaymentDate) + 1;
        
        if (paymentsMade <= 0) {
             return { 
                 success: true, 
                 currentBalance: principal, 
                 interestPaidForMonth: 0, 
                 remainingTermInMonths: originalTermInMonths 
            };
        }

        // Loop through all the months *before* the target month
        for (let i = 0; i < paymentsMade -1; i++) {
            const interestPayment = balance * monthlyRate;
            const principalPayment = principalAndInterest - interestPayment;
            
            if (balance - principalPayment < 0) {
                balance = 0;
                break;
            }
            balance -= principalPayment;
        }

        // Now, `balance` is the balance at the START of the target month.
        // Calculate the interest for this specific month.
        const interestForMonth = balance * monthlyRate;
        const principalForMonth = principalAndInterest - interestForMonth;
        
        // The final balance at the END of the target month.
        let balanceAtEndOfMonth = balance - principalForMonth;
        if (balanceAtEndOfMonth < 0) {
            balanceAtEndOfMonth = 0;
        }
        
        const remainingTermInMonths = originalTermInMonths - paymentsMade;


        return {
            success: true,
            currentBalance: parseFloat(balanceAtEndOfMonth.toFixed(2)),
            interestPaidForMonth: parseFloat(interestForMonth.toFixed(2)),
            remainingTermInMonths: remainingTermInMonths > 0 ? remainingTermInMonths : 0,
        };

    } catch (error: any) {
        console.error("Amortization calculation error:", error);
        return { success: false, error: error.message || 'Failed to calculate loan balance.' };
    }
}
