'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileText, Car, Home, User, ShoppingCart, Banknote, Landmark, Gift, Building, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { Transaction } from './types';

// Keywords for different audit rules
const MEALS_TRAVEL_KEYWORDS = ['meal', 'restaurant', 'travel', 'airline', 'hotel', 'lyft', 'uber'];
const OFFICE_SUPPLIES_KEYWORDS = ['office depot', 'staples', 'software', 'zoom', 'adobe'];
const VEHICLE_KEYWORDS = ['gas', 'auto insurance', 'auto repair', 'toll', 'parking', 'jiffy lube'];
const HOME_OFFICE_KEYWORDS = ['internet', 'utility', 'rent', 'mortgage', 'hoa'];
const PERSONAL_KEYWORDS = ['grocery', 'supermarket', 'salon', 'gym', 'clothing', 'retail'];
const ASSET_KEYWORDS = ['equipment', 'computer', 'furniture', 'improvement'];
const LOAN_KEYWORDS = ['loan payment', 'mortgage payment', 'principal'];
const CHARITY_KEYWORDS = ['donation', 'charity', 'foundation'];

const getFlaggedTransactions = (transactions: Transaction[], keywords: string[], categories?: string[]) => {
    return transactions.filter(tx => {
        const desc = tx.description.toLowerCase();
        const catL2 = tx.categoryHierarchy?.l2?.toLowerCase() || '';
        const keywordMatch = keywords.some(k => desc.includes(k));
        const categoryMatch = categories ? categories.some(c => catL2.includes(c)) : false;
        return keywordMatch || categoryMatch;
    });
};

const getContractorPayments = (transactions: Transaction[]) => {
    const vendorTotals = new Map<string, number>();
    transactions.forEach(tx => {
        if (tx.amount < 0) {
            const vendorName = tx.categoryHierarchy?.l3 || 'Unknown Vendor';
            if (vendorName !== 'Unknown Vendor') {
                vendorTotals.set(vendorName, (vendorTotals.get(vendorName) || 0) + Math.abs(tx.amount));
            }
        }
    });
    return Array.from(vendorTotals.entries())
        .filter(([_, total]) => total > 600)
        .map(([name, total]) => ({ name, total }));
};

const getLargePurchases = (transactions: Transaction[], threshold: number) => {
    return transactions.filter(tx => 
        tx.amount < -threshold && (tx.categoryHierarchy?.l1?.toLowerCase().includes('expense') || tx.categoryHierarchy?.l0?.toLowerCase().includes('expense'))
    );
};

export function TaxReadinessReport({ transactions }: { transactions: Transaction[] }) {

    const flagged = useMemo(() => ({
        scheduleC: getFlaggedTransactions(transactions, MEALS_TRAVEL_KEYWORDS, ['meals', 'travel']),
        office: getFlaggedTransactions(transactions, OFFICE_SUPPLIES_KEYWORDS, ['supplies', 'software', 'utilities']),
        vehicle: getFlaggedTransactions(transactions, VEHICLE_KEYWORDS, ['auto']),
        homeOffice: getFlaggedTransactions(transactions, HOME_OFFICE_KEYWORDS, ['utilities', 'rent', 'mortgage', 'hoa']),
        contractors: getContractorPayments(transactions),
        personal: getFlaggedTransactions(transactions, PERSONAL_KEYWORDS),
        assets: getLargePurchases(transactions, 2500),
        loans: getFlaggedTransactions(transactions, LOAN_KEYWORDS, ['loan']),
        charity: getFlaggedTransactions(transactions, CHARITY_KEYWORDS, ['donation']),
        rental: getFlaggedTransactions(transactions, [], ['repairs', 'security deposit', 'property taxes', 'insurance']),
    }), [transactions]);

    return (
        <div className="space-y-6">
            <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="font-bold">Disclaimer</AlertTitle>
                <AlertDescription>
                    These are automated recommendations for tax readiness only. This is not tax advice. Please confirm all financial decisions with your CPA.
                </AlertDescription>
            </Alert>
            
            <Accordion type="multiple" className="w-full space-y-4">
                <TaxAuditSection icon={FileText} title="Schedule C / Business Expenses" count={flagged.scheduleC.length + flagged.office.length} recommendation="Add business purpose notes for meals/travel and confirm business use % for office expenses."/>
                <TaxAuditSection icon={Car} title="Vehicle & Mileage Readiness" count={flagged.vehicle.length} recommendation="Enable a mileage log to properly deduct vehicle expenses."/>
                <TaxAuditSection icon={Home} title="Home Office Indicators" count={flagged.homeOffice.length} recommendation="If you have a home office, track its square footage and ensure exclusive use for deductions."/>
                <TaxAuditSection icon={User} title="1099 Contractor Watchlist" count={flagged.contractors.length} recommendation="Collect W-9s from vendors paid over $600/year."/>
                <TaxAuditSection icon={ShoppingCart} title="Personal Expense Review" count={flagged.personal.length} recommendation="Reclassify personal expenses from business accounts to 'Owner's Draw'."/>
                <TaxAuditSection icon={Building} title="Fixed Assets vs. Repairs" count={flagged.assets.length} recommendation="Consider categorizing large purchases over $2,500 as 'Fixed Assets' for depreciation."/>
                <TaxAuditSection icon={Landmark} title="Loan & Debt Payments" count={flagged.loans.length} recommendation="Ensure you are splitting loan payments into deductible interest and non-deductible principal."/>
                <TaxAuditSection icon={Gift} title="Charitable Contributions" count={flagged.charity.length} recommendation="Save receipts and confirm if contributions are personal or a business sponsorship."/>
            </Accordion>

            <SummaryCard flagged={flagged} />
        </div>
    );
}

const TaxAuditSection = ({ icon: Icon, title, count, recommendation }: { icon: React.ElementType, title: string, count: number, recommendation: string }) => {
    if (count === 0) return null;
    return (
        <AccordionItem value={title}>
            <Card>
                <AccordionTrigger className="p-4 hover:no-underline">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-muted rounded-full">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-left">{title}</h3>
                            <p className="text-sm text-muted-foreground text-left">{count} items flagged</p>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="p-4 pt-0">
                    <Alert>
                        <AlertTitle className="font-bold">Recommendation</AlertTitle>
                        <AlertDescription>{recommendation}</AlertDescription>
                    </Alert>
                </AccordionContent>
            </Card>
        </AccordionItem>
    );
}

const SummaryCard = ({ flagged }: { flagged: any }) => (
    <Card>
        <CardHeader>
            <CardTitle>Audit Summary</CardTitle>
            <CardDescription>Key items identified for your review.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
            <SummaryItem title="Items to Document" count={flagged.scheduleC.length + flagged.office.length} />
            <SummaryItem title="Potential 1099 Vendors" count={flagged.contractors.length} />
            <SummaryItem title="Asset Candidates (>$2,500)" count={flagged.assets.length} />
            <SummaryItem title="Personal Expenses to Review" count={flagged.personal.length} />
        </CardContent>
    </Card>
);

const SummaryItem = ({ title, count }: { title: string; count: number }) => (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
        <p className="font-medium text-sm">{title}</p>
        <Badge variant={count > 0 ? "destructive" : "default"}>{count}</Badge>
    </div>
)
