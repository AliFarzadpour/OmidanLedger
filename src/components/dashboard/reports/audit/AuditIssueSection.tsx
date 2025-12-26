'use client';

import { Card } from '@/components/ui/card';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';
import type { AuditIssue } from './types';

interface AuditIssueSectionProps {
  type: string;
  title: string;
  issues?: AuditIssue[];
}

export function AuditIssueSection({ type, title, issues }: AuditIssueSectionProps) {
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
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {issues.map(issue => (
                                <TableRow key={issue.transaction.id}>
                                    <TableCell>{issue.transaction.date}</TableCell>
                                    <TableCell>{issue.transaction.description}</TableCell>
                                    <TableCell><Badge variant="outline" className="font-normal">{issue.message}</Badge></TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(issue.transaction.amount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </AccordionContent>
            </Card>
        </AccordionItem>
    );
}
