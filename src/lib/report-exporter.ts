'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const toCurrency = (num: number) => {
    return (num || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

export const exportToPDF = (title: string, data: any[], params: any) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`For period: ${params.startDate} to ${params.endDate}`, 14, 30);
    doc.text(`Scope: ${params.property}`, 14, 35);

    // Table
    if (data.length > 0) {
        const head = [Object.keys(data[0])];
        const body = data.map(row => Object.values(row).map(val => {
            if (typeof val === 'number') return toCurrency(val);
            if (val instanceof Date) return val.toLocaleDateString();
            return String(val);
        }));

        autoTable(doc, {
            head,
            body,
            startY: 45,
            headStyles: { fillColor: [41, 128, 185] },
        });
    } else {
        doc.text("No data available for this report.", 14, 50);
    }
    
    doc.save(`${title.replace(/ /g, '_')}_Report.pdf`);
};

export const exportToCSV = (title: string, data: any[]) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','),
        ...data.map(row => 
            headers.map(fieldName => {
                let cell = row[fieldName] === null || row[fieldName] === undefined ? '' : row[fieldName];
                if (typeof cell === 'string') {
                    cell = `"${cell.replace(/"/g, '""')}"`;
                }
                return cell;
            }).join(',')
        )
    ].join('\n');

    const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${title.replace(/ /g, '_')}_Report.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};