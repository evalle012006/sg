import React, { useState, useRef, useEffect } from 'react';
import { FileDown, ChevronDown, FileSpreadsheet, FileText, Loader } from 'lucide-react';
import ExcelJS from 'exceljs';
import Progress from './Progress';
import { Dialog, DialogContent } from './Dialog';

const CHUNK_SIZE = 100;

const ExportButton = ({ 
  data, 
  columns, 
  columnTypes, 
  startDate, 
  endDate,
  onExportStart,
  onExportComplete,
  onExportError 
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [showProgress, setShowProgress] = useState(false);
  const dropdownRef = useRef(null);
  const dropdownPanelRef = useRef(null);

  const filterDataByColumns = (data, selectedColumns) => {
    return data.map(row => {
      const filteredRow = {};
      selectedColumns.forEach(col => {
        // For the frontend column keys (q_0, q_1, etc.), look up the actual question in columnTypes
        // and use that to find the corresponding value in the row data
        if (col.startsWith('q_')) {
          const question = columnTypes[col];
          filteredRow[col] = row[question] ?? '';
        } else {
          filteredRow[col] = row[col] ?? '';
        }
      });
      return filteredRow;
    });
  };

  const processDataInChunks = async (rawData, selectedColumns, startIdx = 0) => {
    const totalRecords = rawData.length;
    const processedData = [];
    let currentIdx = startIdx;

    while (currentIdx < totalRecords) {
      const chunk = rawData.slice(currentIdx, currentIdx + CHUNK_SIZE);
      const processedChunk = filterDataByColumns(chunk, selectedColumns);
      processedData.push(...processedChunk);
      
      currentIdx += CHUNK_SIZE;

      const percentComplete = Math.round((currentIdx / totalRecords) * 100);
      setProgress(percentComplete);
      setProgressMessage(`Processing data: ${percentComplete}%`);

      await new Promise(resolve => setTimeout(resolve, 0));
    }

    return processedData;
  };

  const fetchAllData = async () => {
    setProgressMessage('Fetching all data...');
    const queryParams = new URLSearchParams({
      startDate: startDate || '',
      endDate: endDate || '',
      exportAll: 'true'
    });

    try {
      const response = await fetch(`/api/reports/export-bookings?${queryParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch export data');
      }
      const { data } = await response.json();
      return data;
    } catch (error) {
      setProgressMessage('Error fetching data. Please try again.');
      throw error;
    }
  };

  const exportToXLSX = async (processedData, selectedColumns) => {
    try {
      setProgressMessage('Creating Excel file...');
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Report');

      // Add headers using columnTypes for mapping
      const headers = selectedColumns.map(col => columnTypes[col] || col);
      worksheet.addRow(headers);

      // Style headers
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      // Process data in chunks
      let currentRow = 2;
      for (let i = 0; i < processedData.length; i += CHUNK_SIZE) {
        const chunk = processedData.slice(i, i + CHUNK_SIZE);
        
        chunk.forEach(row => {
          const rowData = selectedColumns.map(col => {
            const value = row[col];
            if (value instanceof Date) {
              return value;
            } else if (value === null || value === undefined) {
              return '';
            } else if (typeof value === 'number') {
              return value;
            } else {
              return String(value).trim();
            }
          });
          worksheet.addRow(rowData);
        });

        const percentComplete = Math.round((i + chunk.length) / processedData.length * 100);
        setProgress(percentComplete);
        setProgressMessage(`Processing data: ${percentComplete}%`);
        
        await new Promise(resolve => setTimeout(resolve, 0));
        currentRow += chunk.length;
      }

      // Auto-fit columns
      worksheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.min(maxLength + 2, 50);
      });

      setProgressMessage('Generating file...');
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `booking_report_${dateStr}${startDate ? `_${startDate}_${endDate}` : ''}.xlsx`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setProgressMessage('Download complete!');
    } catch (error) {
      console.error('XLSX Export error:', error);
      setProgressMessage('Error creating Excel file. Please try again.');
      throw error;
    }
  };

  const exportToCSV = async (processedData, selectedColumns) => {
    try {
      setProgressMessage('Creating CSV file...');
      
      // Create headers using columnTypes for mapping
      const headers = selectedColumns.map(col => columnTypes[col] || col);
      let csvContent = headers.map(formatCSVCell).join(',') + '\n';
      
      // Process data in chunks
      for (let i = 0; i < processedData.length; i += CHUNK_SIZE) {
        const chunk = processedData.slice(i, i + CHUNK_SIZE);
        
        chunk.forEach(row => {
          const rowData = selectedColumns.map(col => formatCSVCell(row[col]));
          csvContent += rowData.join(',') + '\n';
        });

        const percentComplete = Math.round((i + chunk.length) / processedData.length * 100);
        setProgress(percentComplete);
        setProgressMessage(`Processing data: ${percentComplete}%`);
        
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `booking_report_${dateStr}${startDate ? `_${startDate}_${endDate}` : ''}.csv`;
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setProgressMessage('Download complete!');
    } catch (error) {
      console.error('CSV Export error:', error);
      setProgressMessage('Error creating CSV file. Please try again.');
      throw error;
    }
  };

  const formatCSVCell = (value) => {
    if (value == null) return '';
    const stringValue = value.toString();
    if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const exportData = async (format, exportAll = false) => {
    try {
      setIsExporting(true);
      setShowProgress(true);
      setProgress(0);
      onExportStart?.();

      const rawData = await fetchAllData();
      
      // For exportAll, use all columns from the first row of data
      // For selected fields, use the columns passed in via props
      const columnsToUse = exportAll ? Object.keys(rawData[0] || {}) : columns;
      
      setProgressMessage('Processing data...');
      const processedData = await processDataInChunks(rawData, columnsToUse);

      if (format === 'csv') {
        await exportToCSV(processedData, columnsToUse);
      } else {
        await exportToXLSX(processedData, columnsToUse);
      }

      onExportComplete?.();
      
      setTimeout(() => {
        setShowProgress(false);
        setProgress(0);
        setProgressMessage('');
      }, 1000);
    } catch (error) {
      console.error('Export error:', error);
      onExportError?.(error);
      setProgressMessage('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
      setShowDropdown(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownPanelRef.current && !dropdownPanelRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-300"
        >
          {isExporting ? (
            <Loader className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          Export
          <ChevronDown className="h-4 w-4" />
        </button>

        {showDropdown && !isExporting && (
          <div className="absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10" ref={dropdownPanelRef}>
            <div className="py-1" role="menu">
              <div className="px-4 py-2 text-sm font-medium text-gray-700 border-b">
                Export Selected Fields
              </div>
              <button
                onClick={() => exportData('xlsx', false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export as Excel
              </button>
              <button
                onClick={() => exportData('csv', false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
              >
                <FileText className="h-4 w-4" />
                Export as CSV
              </button>
              
              <div className="border-t my-1"></div>
              
              <div className="px-4 py-2 text-sm font-medium text-gray-700 border-b">
                Export All Fields
              </div>
              <button
                onClick={() => exportData('xlsx', true)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export All as Excel
              </button>
              <button
                onClick={() => exportData('csv', true)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
              >
                <FileText className="h-4 w-4" />
                Export All as CSV
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showProgress} onOpenChange={setShowProgress}>
        <DialogContent>
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              {progressMessage}
            </h3>
            <Progress value={progress} className="w-full" />
            {progress === 100 && (
              <p className="text-sm text-green-600">
                Export completed successfully!
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ExportButton;