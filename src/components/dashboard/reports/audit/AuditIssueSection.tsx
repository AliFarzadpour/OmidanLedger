'use client';

import { Card } from '@/components/ui/card';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ArrowUpDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { AuditIssue } from './types';
import { cn } from '@/lib/utils';
import React from 'react';
import { Button } from '@/components/ui/button';

export type SortConfig = {
  key: 'date' | 'description' | 'category' | 'amount';
  direction: 'asc' | 'desc';
};

interface AuditIssueSectionProps {
  type: string;
  title: string;
  icon: React.ElementType;
  issues?: AuditIssue[];
  selectedIds: string[];
  onSelectionChange: (id: string, checked: boolean) => void;
  sortConfig: SortConfig;
  onSort: (key: SortConfig['key']) => void;
  bankAccountMap: Map<string, string>;
}

const primaryCategoryColors: Record<string, string> = {
  'Income': 'bg-green-100 text-green-800',
  'Expense': 'bg-blue-100 text-blue-800',
  'Equity': 'bg-indigo-100 text-indigo-800',
  'Liability': 'bg-orange-100 text-orange-800',
  'Asset': 'bg-gray-200 text-gray-800',
};

export function AuditIssueSection({ type, title, icon: Icon, issues, selectedIds, onSelectionChange, sortConfig, onSort, bankAccountMap }: AuditIssueSectionProps) {
    if (!issues || issues.length === 0) return null;

    const handleSelectAll = (checked: boolean) => {
        issues.forEach(issue => onSelectionChange(issue.transaction.id, checked));
    };

    const areAllSelected = issues.every(issue => selectedIds.includes(issue.transaction.id));
    
    const getSortIcon = (key: SortConfig['key']) => (
        sortConfig.key === key ? <ArrowUpDown className="h-4 w-4 inline" /> : <ArrowUpDown className="h-4 w-4 inline opacity-30" />
    );

    return (
        <AccordionItem value={type}>
            <Card className="shadow-md">
                <AccordionTrigger className="p-6 hover:no-underline">
                    <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-destructive" />
                        <h3 className="text-lg font-semibold">{title}</h3>
                        <Badge variant="destructive">{issues.length} Found</Badge>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12"><Checkbox 
                                    checked={areAllSelected}
                                    onCheckedChange={handleSelectAll}
                                /></TableHead>
                                <TableHead><Button variant="ghost" size="sm" onClick={() => onSort('date')}>Date {getSortIcon('date')}</Button></TableHead>
                                <TableHead><Button variant="ghost" size="sm" onClick={() => onSort('description')}>Description {getSortIcon('description')}</Button></TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead><Button variant="ghost" size="sm" onClick={() => onSort('category')}>Category {getSortIcon('category')}</Button></TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead className="text-right"><Button variant="ghost" size="sm" onClick={() => onSort('amount')}>Amount {getSortIcon('amount')}</Button></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {issues.map(issue => {
                                const tx = issue.transaction;
                                const cats = tx.categoryHierarchy || { l0: 'N/A', l1: 'N/A', l2: 'N/A' };
                                const accountName = tx.bankAccountId ? bankAccountMap.get(tx.bankAccountId) : 'N/A';
                                return (
                                    <TableRow key={tx.id}>
                                        <TableCell><Checkbox 
                                            checked={selectedIds.includes(tx.id)}
                                            onCheckedChange={(checked) => onSelectionChange(tx.id, !!checked)}
                                        /></TableCell>
                                        <TableCell>{tx.date}</TableCell>
                                        <TableCell>{tx.description}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{accountName}</TableCell>
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
