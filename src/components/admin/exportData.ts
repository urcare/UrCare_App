import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn { key: string; label: string }

function cell(row: Record<string, any>, key: string): string {
  const v = row[key];
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

/** One CSV per export — Excel opens this natively. A UTF-8 BOM keeps Hindi
 *  text (names, product titles) readable instead of garbled when opened on
 *  Windows Excel, which otherwise guesses the wrong encoding. */
export function exportToCSV(filename: string, columns: ExportColumn[], rows: Record<string, any>[]) {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [
    columns.map((c) => escape(c.label)).join(','),
    ...rows.map((r) => columns.map((c) => escape(cell(r, c.key))).join(',')),
  ];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

export function exportToPDF(filename: string, title: string, columns: ExportColumn[], rows: Record<string, any>[]) {
  const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Exported ${new Date().toLocaleString()} — ${rows.length} rows`, 14, 21);
  autoTable(doc, {
    startY: 26,
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => cell(r, c.key))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [5, 150, 105] },
    theme: 'striped',
  });
  doc.save(`${filename}.pdf`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
