'use client';

import { Card } from '@/components/ui/card';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { AuditIssue } from './types';
import { cn } from '@/lib/utils';

interface AuditIssueSectionProps {
  type: string;
  title: string;
  issues?: AuditIssue[];
  selectedIds: string[];
  onSelectionChange: (id: string, checked: boolean) => void;
}

const primaryCategoryColors: Record<string, string> = {
  'Income': 'bg-green-100 text-green-800',
  'Expense': 'bg-blue-100 text-blue-800',
  'Equity': 'bg-indigo-100 text-indigo-800',
  'Liability': 'bg-orange-100 text-orange-800',
  'Asset': 'bg-gray-200 text-gray-800',
};

export function AuditIssueSection({ type, title, issues, selectedIds, onSelectionChange }: AuditIssueSectionProps) {
    if (!issues || issues.length === 0) return null;

    return (
        <AccordionItem value={type}>
            <Card className="shadow-md">
                <AccordionTrigger className="p-6 hover:no-underline">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        <h3 className="text-lg font-semibold">{title}</h3>
                        <Badge variant="destructive">{issues.length} Found</Badge>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12"><Checkbox 
                                    checked={issues.every(issue => selectedIds.includes(issue.transaction.id))}
                                    onCheckedChange={(checked) => issues.forEach(issue => onSelectionChange(issue.transaction.id, !!checked))}
                                /></TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {issues.map(issue => {
                                const tx = issue.transaction;
                                const cats = tx.categoryHierarchy || { l0: 'N/A', l1: 'N/A', l2: 'N/A' };
                                return (
                                    <TableRow key={tx.id}>
                                        <TableCell><Checkbox 
                                            checked={selectedIds.includes(tx.id)}
                                            onCheckedChange={(checked) => onSelectionChange(tx.id, !!checked)}
                                        /></TableCell>
                                        <TableCell>{tx.date}</TableCell>
                                        <TableCell>{tx.description}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn('w-fit border-0 font-semibold px-2 py-1', primaryCategoryColors[cats.l0] || 'bg-slate-100')}>
                                                {cats.l0}
                                            </Badge>
                                            <p className="text-xs text-muted-foreground">{cats.l1} &gt; {cats.l2}</p>
                                        </TableCell>
                                        <TableCell><Badge variant="outline" className="font-normal">{issue.message}</Badge></TableCell>
                                        <TableCell className="text-right font-mono">{formatCurrency(tx.amount)}</TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </AccordionContent>
            </Card>
        </AccordionItem>
    );
}
