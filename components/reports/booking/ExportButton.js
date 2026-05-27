import React, { useState, useRef, useEffect } from 'react';
import { FileDown, ChevronDown, FileSpreadsheet, FileText, Loader } from 'lucide-react';
import ExcelJS from 'exceljs';
import Progress from './Progress';
import { Dialog, DialogContent } from './Dialog';

const CHUNK_SIZE = 100;

// Columns that must be forced to text in Excel to prevent numeric truncation
// (e.g. booking IDs like 102192 being treated as numbers)
const TEXT_ONLY_COLUMNS = new Set(['BOOKING', 'GUEST_PHONE']);

const ExportButton = ({
  data,
  columns,
  columnTypes,
  startDate,
  endDate,
  dateField   = 'created_at',   // mirrors DateFilterMode in reports-index
  occupancy   = false,
  onExportStart,
  onExportComplete,
  onExportError,
}) => {
  const [showDropdown, setShowDropdown]     = useState(false);
  const [isExporting, setIsExporting]       = useState(false);
  const [progress, setProgress]             = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [showProgress, setShowProgress]     = useState(false);
  const dropdownRef     = useRef(null);
  const dropdownPanelRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownPanelRef.current && !dropdownPanelRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchAllData = async () => {
    setProgressMessage('Fetching all data…');
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate)   params.set('endDate',   endDate);
    if (dateField) params.set('dateField', dateField);
    if (occupancy) params.set('occupancy', 'true');

    const response = await fetch(`/api/reports/export-bookings?${params}`);
    if (!response.ok) throw new Error('Failed to fetch export data');
    const { data } = await response.json();
    return data;
  };

  // ─── Column filtering ───────────────────────────────────────────────────────

  const filterDataByColumns = (rawData, selectedColumns) =>
    rawData.map(row => {
      const filtered = {};
      selectedColumns.forEach(col => {
        if (col.startsWith('q_')) {
          // QA columns — key is q_N but row data is keyed by question text
          const question = columnTypes[col];
          filtered[col] = row[question] ?? row[col] ?? '';
        } else {
          filtered[col] = row[col] ?? '';
        }
      });
      return filtered;
    });

  const processDataInChunks = async (rawData, selectedColumns) => {
    const total = rawData.length;
    const processed = [];
    let idx = 0;
    while (idx < total) {
      const chunk = rawData.slice(idx, idx + CHUNK_SIZE);
      processed.push(...filterDataByColumns(chunk, selectedColumns));
      idx += CHUNK_SIZE;
      const pct = Math.round((idx / total) * 100);
      setProgress(pct);
      setProgressMessage(`Processing… ${pct}%`);
      await new Promise(r => setTimeout(r, 0));
    }
    return processed;
  };

  // ─── Export to XLSX ─────────────────────────────────────────────────────────

  const exportToXLSX = async (processedData, selectedColumns) => {
    setProgressMessage('Creating Excel file…');
    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    const headers = selectedColumns.map(col => columnTypes[col] || col);
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Set column number format — text for ID/phone cols to prevent numeric coercion
    selectedColumns.forEach((col, i) => {
      const wsCol = worksheet.getColumn(i + 1);
      wsCol.numFmt = TEXT_ONLY_COLUMNS.has(col) ? '@' : 'General';
    });

    let processed = 0;
    for (let i = 0; i < processedData.length; i += CHUNK_SIZE) {
      const chunk = processedData.slice(i, i + CHUNK_SIZE);
      chunk.forEach(row => {
        const rowData = selectedColumns.map(col => {
          const val = row[col];
          if (val == null) return '';
          // Force text for booking IDs etc.
          if (TEXT_ONLY_COLUMNS.has(col)) return String(val);
          if (typeof val === 'number') return val;
          return String(val).trim();
        });
        worksheet.addRow(rowData);
      });
      processed += chunk.length;
      const pct = Math.round((processed / processedData.length) * 100);
      setProgress(pct);
      setProgressMessage(`Writing rows… ${pct}%`);
      await new Promise(r => setTimeout(r, 0));
    }

    // Auto-fit column widths
    worksheet.columns.forEach(col => {
      let maxLen = 10;
      col.eachCell({ includeEmpty: true }, cell => {
        const len = cell.value ? cell.value.toString().length : 0;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen + 2, 50);
    });

    setProgressMessage('Generating file…');
    const buffer = await workbook.xlsx.writeBuffer();
    const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    triggerDownload(blob, buildFilename('xlsx'));
    setProgressMessage('Download complete!');
  };

  // ─── Export to CSV ──────────────────────────────────────────────────────────

  const exportToCSV = async (processedData, selectedColumns) => {
    setProgressMessage('Creating CSV file…');
    const headers = selectedColumns.map(col => formatCSVCell(columnTypes[col] || col));
    let csv = headers.join(',') + '\n';

    for (let i = 0; i < processedData.length; i += CHUNK_SIZE) {
      const chunk = processedData.slice(i, i + CHUNK_SIZE);
      chunk.forEach(row => {
        csv += selectedColumns.map(col => formatCSVCell(row[col])).join(',') + '\n';
      });
      const pct = Math.round(((i + chunk.length) / processedData.length) * 100);
      setProgress(pct);
      setProgressMessage(`Writing rows… ${pct}%`);
      await new Promise(r => setTimeout(r, 0));
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, buildFilename('csv'));
    setProgressMessage('Download complete!');
  };

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const formatCSVCell = (value) => {
    if (value == null) return '';
    const s = value.toString();
    return (s.includes(',') || s.includes('\n') || s.includes('"'))
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const buildFilename = (ext) => {
    const date = new Date().toISOString().split('T')[0];
    const range = startDate ? `_${startDate}_to_${endDate}` : '';
    const mode  = dateField !== 'created_at' ? `_by_${dateField}` : '';
    const occ   = occupancy ? '_occupancy' : '';
    return `booking_report_${date}${range}${mode}${occ}.${ext}`;
  };

  const triggerDownload = (blob, filename) => {
    const url  = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href  = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // ─── Main export orchestrator ───────────────────────────────────────────────

  const exportData = async (format, exportAll = false) => {
    try {
      setIsExporting(true);
      setShowProgress(true);
      setProgress(0);
      onExportStart?.();

      const rawData        = await fetchAllData();
      const columnsToUse   = exportAll ? Object.keys(rawData[0] || {}) : columns;

      setProgressMessage('Processing data…');
      const processedData  = await processDataInChunks(rawData, columnsToUse);

      if (format === 'csv') {
        await exportToCSV(processedData, columnsToUse);
      } else {
        await exportToXLSX(processedData, columnsToUse);
      }

      onExportComplete?.();
      setTimeout(() => { setShowProgress(false); setProgress(0); setProgressMessage(''); }, 1500);
    } catch (error) {
      console.error('Export error:', error);
      onExportError?.(error);
      setProgressMessage('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
      setShowDropdown(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(v => !v)}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-sea text-white rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-sea focus:ring-offset-2 disabled:opacity-50"
        >
          {isExporting ? <Loader className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Export
          <ChevronDown className="h-4 w-4" />
        </button>

        {showDropdown && !isExporting && (
          <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10" ref={dropdownPanelRef}>
            <div className="py-1">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">Selected Columns</div>
              <button onClick={() => exportData('xlsx', false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left">
                <FileSpreadsheet className="h-4 w-4 text-green-600" /> Export as Excel
              </button>
              <button onClick={() => exportData('csv', false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left">
                <FileText className="h-4 w-4 text-blue-600" /> Export as CSV
              </button>
              <div className="border-t my-1" />
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">All Fields</div>
              <button onClick={() => exportData('xlsx', true)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left">
                <FileSpreadsheet className="h-4 w-4 text-green-600" /> Export All as Excel
              </button>
              <button onClick={() => exportData('csv', true)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left">
                <FileText className="h-4 w-4 text-blue-600" /> Export All as CSV
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showProgress} onOpenChange={setShowProgress}>
        <DialogContent>
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">{progressMessage}</h3>
            <Progress value={progress} className="w-full" />
            {progress === 100 && <p className="text-sm text-green-600">Export completed successfully!</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ExportButton;