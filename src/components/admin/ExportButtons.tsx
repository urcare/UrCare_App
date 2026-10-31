import React from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { exportToCSV, exportToPDF, ExportColumn } from './exportData';

interface ExportButtonsProps {
  filename: string;
  title: string;
  columns: ExportColumn[];
  rows: Record<string, any>[];
}

/** Dropped into any admin tab that shows a table — exports exactly what's
 *  on screen (already filtered/searched) to a real .csv (opens in Excel)
 *  or a formatted .pdf. */
export const ExportButtons: React.FC<ExportButtonsProps> = ({ filename, title, columns, rows }) => (
  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={() => exportToCSV(filename, columns, rows)}
      disabled={!rows.length}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 disabled:opacity-40 cursor-pointer"
      title="Export to Excel (.csv)"
    >
      <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
    </button>
    <button
      type="button"
      onClick={() => exportToPDF(filename, title, columns, rows)}
      disabled={!rows.length}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 disabled:opacity-40 cursor-pointer"
      title="Export to PDF"
    >
      <FileText className="w-3.5 h-3.5" /> PDF
    </button>
  </div>
);
