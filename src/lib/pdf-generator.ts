'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export function generateTenantStatement(tenant: any, property: any, transactions: any[], month: string) {
  const doc = new jsPDF();
  const monthDate = new Date(month + '-02'); // Use day 2 to avoid timezone issues
  const dateStr = format(monthDate, 'MMMM yyyy');
  const fileDateStr = format(monthDate, 'yyyy-MM');

  // --- Filter transactions for the selected month ---
  const startDate = startOfMonth(monthDate);
  const endDate = endOfMonth(monthDate);
  const monthlyTransactions = transactions.filter(tx => {
    const txDate = new Date(tx.date);
    return txDate >= startDate && txDate <= endDate;
  });

  // 1. Header & Branding
  doc.setFontSize(20);
  doc.setTextColor(29, 78, 216); // primary-600
  doc.setFont('helvetica', 'bold');
  doc.text('Monthly Rent Statement', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text(`Statement Period: ${dateStr}`, 14, 30);

  // 2. Property & Tenant Info
  const fullAddress = `${property.address.street}, ${property.address.city}, ${property.address.state} ${property.address.zip}`;
  
  doc.setFontSize(11);
  doc.setTextColor(40);
  doc.setFont('helvetica', 'bold');
  doc.text('Property Details', 14, 45);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(property.name, 14, 51);
  doc.text(fullAddress, 14, 56);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Tenant Information', 120, 45);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(tenant.email, 120, 51);

  // 3. Financial Summary Table
  const tableData = monthlyTransactions.map(tx => {
    const isPayment = tx.amount > 0;
    return [
      format(new Date(tx.date), 'MM/dd/yyyy'),
      tx.description,
      isPayment ? `$${tx.amount.toFixed(2)}` : '',
      !isPayment ? `$${Math.abs(tx.amount).toFixed(2)}` : '',
    ];
  });
  
  // Calculate totals for the footer
  const totalPayments = monthlyTransactions.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
  const totalCharges = monthlyTransactions.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + tx.amount, 0);

  autoTable(doc, {
    startY: 70,
    head: [['Date', 'Description', 'Payments', 'Charges']],
    body: tableData,
    foot: [
        ['', 'Total Payments', `$${totalPayments.toFixed(2)}`, ''],
        ['', 'Total Charges', '', `$${Math.abs(totalCharges).toFixed(2)}`],
        ['', { content: 'Current Balance Due', styles: { fontStyle: 'bold' } }, '', { content: `$${(tenant.billing.balance || 0).toFixed(2)}`, styles: { fontStyle: 'bold' } }],
    ],
    theme: 'striped',
    headStyles: { 
        fillColor: [30, 136, 229], // primary-600
        textColor: 255,
        fontStyle: 'bold'
    },
    footStyles: {
        fillColor: [241, 245, 249], // slate-100
        textColor: 40,
    },
    didDrawPage: (data) => {
        // Footer with page numbers
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${data.pageNumber} of ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
    }
  });

  // 4. Save/Download
  doc.save(`Statement_${tenant.email.split('@')[0]}_${fileDateStr}.pdf`);
}
