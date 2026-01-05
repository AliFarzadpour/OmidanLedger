
'use server';

interface AmortizationInput {
    principal: number;
    annualRate: number;
    termInYears: number;
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
    termInYears,
    startDate
}: AmortizationInput): Promise<AmortizationResult> {

    if (!principal || !annualRate || !termInYears || !startDate) {
        return { success: false, error: 'Missing required amortization parameters.' };
    }

    try {
        const monthlyRate = annualRate / 100 / 12;
        const numberOfPayments = termInYears * 12;

        // Calculate monthly payment (M) using the loan amortization formula
        const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);

        const start = new Date(startDate);
        const now = new Date();
        
        // Calculate the number of full months passed
        let monthsPassed = (now.getFullYear() - start.getFullYear()) * 12;
        monthsPassed -= start.getMonth();
        monthsPassed += now.getMonth();
        
        if (monthsPassed <= 0) {
            return { success: true, currentBalance: principal };
        }

        let currentBalance = principal;

        for (let i = 0; i < monthsPassed; i++) {
            const interestPayment = currentBalance * monthlyRate;
            const principalPayment = monthlyPayment - interestPayment;
            currentBalance -= principalPayment;
        }

        return { success: true, currentBalance: Math.max(0, currentBalance) }; // Ensure balance doesn't go negative

    } catch (error: any) {
        console.error("Amortization calculation error:", error);
        return { success: false, error: error.message || 'Failed to calculate loan balance.' };
    }
}
