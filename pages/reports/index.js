import React, { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Search, Download, ToggleLeft, ToggleRight } from 'lucide-react';
import DateRangeFilter from '../../components/reports/booking/date-range-filter';
import ColumnSelector from '../../components/reports/booking/ColumnSelector';
import ExportButton from '../../components/reports/booking/ExportButton';
import StatusBadge from '../../components/ui-v2/StatusBadge';
import { processAnswer } from '../../lib/report-utils';
import moment from 'moment';
import Spinner from '../../components/ui/spinner';
import { useDispatch } from 'react-redux';
import { globalActions } from '../../store/globalSlice';

const Layout = dynamic(() => import('../../components/layout'));

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_COLUMN_TYPES = {
  BOOKING:        'Booking',
  GUEST:          'Guest',
  BOOKING_TYPE:   'Booking Type',
  CREATED:        'Created',
  STATUS:         'Status',
  ELIGIBILITY:    'Eligibility',
  CHECK_IN_DATE:  'Check In Date',
  CHECK_OUT_DATE: 'Check Out Date',
};

const OCCUPANCY_COLUMN_TYPES = {
  DATES_OF_STAY:    'Dates of Stay',
  FUNDER:           'Funder',
  NIGHTS_IN_PERIOD: 'Nights in Period',
};

const DATE_FILTER_MODES = [
  { value: 'created_at',               label: 'Created Date' },
  { value: 'preferred_arrival_date',   label: 'Check-in Date' },
  { value: 'preferred_departure_date', label: 'Check-out Date' },
];

const STATUS_BADGE_MAP = {
  booking_confirmed: { type: 'success',   label: 'Booking Confirmed' },
  ready_to_process:  { type: 'pending',   label: 'Ready To Process' },
  in_progress:       { type: 'pending',   label: 'In Progress' },
  pending_approval:  { type: 'pending',   label: 'Pending Approval' },
  enquiry:           { type: 'secondary', label: 'Enquiry' },
  cancelled:         { type: 'error',     label: 'Cancelled' },
  booking_cancelled: { type: 'error',     label: 'Booking Cancelled' },
  guest_cancelled:   { type: 'error',     label: 'Guest Cancelled' },
  late_cancelled:    { type: 'error',     label: 'Late Cancellation' },
  waitlisted:        { type: 'draft',     label: 'Waitlisted' },
  archived:          { type: 'archived',  label: 'Archived' },
  eligible:          { type: 'success',   label: 'Eligible' },
  ineligible:        { type: 'error',     label: 'Ineligible' },
  pending:           { type: 'pending',   label: 'Pending' },
  not_assessed:      { type: 'draft',     label: 'Not Assessed' },
};

const getStatusBadgeProps = (value) => {
  if (!value) return { type: 'draft', label: '—' };
  const key = value.toString().toLowerCase().trim().replace(/\s+/g, '_');
  if (STATUS_BADGE_MAP[key]) return STATUS_BADGE_MAP[key];
  return { type: 'success', label: value.toString().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) };
};

// ─── Shared Paginated Table ───────────────────────────────────────────────────

const PaginatedTable = ({ columns, data, columnTypes, dataVersion, renderCell }) => {
  const [searchTerms, setSearchTerms] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const itemsPerPageOptions = [10, 15, 25, 50];

  useEffect(() => { setSearchTerms({}); setCurrentPage(1); }, [dataVersion]);

  const filteredData = useMemo(() => {
    if (Object.keys(searchTerms).every(k => !searchTerms[k])) return data;
    return data.filter(item =>
      columns.every(col => {
        const term = searchTerms[col]?.toLowerCase();
        if (!term) return true;
        const val = item[col];
        return val != null && String(val).toLowerCase().includes(term);
      })
    );
  }, [data, searchTerms, columns]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));

  const paginatedData = useMemo(() => {
    const s = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(s, s + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const handleSearch = (col, val) => { setSearchTerms(p => ({ ...p, [col]: val })); setCurrentPage(1); };

  const renderPageButtons = () => {
    const buttons = [];
    const max = 5;
    let start = Math.max(1, currentPage - Math.floor(max / 2));
    let end   = Math.min(totalPages, start + max - 1);
    if (end - start < max - 1) start = Math.max(1, end - max + 1);
    if (start > 1) buttons.push(<span key="el-s" className="px-2 text-gray-400">…</span>);
    for (let i = start; i <= end; i++) {
      buttons.push(
        <button key={i} onClick={() => setCurrentPage(i)}
          className={`px-3 py-1 mx-0.5 rounded text-sm ${currentPage === i ? 'bg-sea text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >{i}</button>
      );
    }
    if (end < totalPages) buttons.push(<span key="el-e" className="px-2 text-gray-400">…</span>);
    return buttons;
  };

  return (
    <div className="bg-white rounded-lg border border-neutral-light overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: '#ECECEC' }}>
              {columns.map(col => (
                <th key={col} className="px-4 py-3 text-left text-gray-700 text-xs uppercase tracking-wider font-bold whitespace-nowrap">
                  {columnTypes[col] || col}
                </th>
              ))}
            </tr>
            <tr className="bg-gray-50">
              {columns.map(col => (
                <th key={`s-${col}`} className="px-4 py-2 text-left font-normal">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input type="text" placeholder="Search"
                      className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-sea"
                      value={searchTerms[col] || ''}
                      onChange={e => handleSearch(col, e.target.value)}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-light bg-white">
            {paginatedData.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-6 py-12 text-center text-gray-400 text-sm">No data available</td></tr>
            ) : (
              paginatedData.map((row, i) => (
                <tr key={i} className="hover:bg-[#F2F5F9] transition-colors">
                  {columns.map(col => (
                    <td key={col} className="px-4 py-3 text-sm text-neutral-darker">
                      {renderCell(col, row[col])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-3 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3 sm:mb-0">
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <span>View</span>
            <select value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="border border-gray-200 rounded px-2 py-1 text-sm"
            >
              {itemsPerPageOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <span className="text-sm text-gray-500">
            {filteredData.length === 0 ? 'No results'
              : `${Math.min((currentPage - 1) * itemsPerPage + 1, filteredData.length)}–${Math.min(currentPage * itemsPerPage, filteredData.length)} of ${filteredData.length.toLocaleString()}`}
            {Object.values(searchTerms).some(Boolean) && data.length !== filteredData.length &&
              <span className="ml-1 text-gray-400">(filtered from {data.length.toLocaleString()})</span>}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
            className="px-2 py-1 text-gray-400 hover:text-gray-700 disabled:opacity-30">‹</button>
          {renderPageButtons()}
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
            className="px-2 py-1 text-gray-400 hover:text-gray-700 disabled:opacity-30">›</button>
        </div>
      </div>
    </div>
  );
};

// ─── Date Filter Mode Selector ────────────────────────────────────────────────

const DateFilterModeSelector = ({ value, onChange }) => (
  <div className="flex items-center gap-2">
    <span className="text-sm text-gray-500 whitespace-nowrap">Filter by</span>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sea"
    >
      {DATE_FILTER_MODES.map(m => (
        <option key={m.value} value={m.value}>{m.label}</option>
      ))}
    </select>
  </div>
);

// ─── Booking List Report ──────────────────────────────────────────────────────

const BookingListReport = ({ startDate, endDate, dateFilterMode, showOccupancy }) => {
  const [bookings, setBookings]               = useState([]);
  const [columnTypes, setColumnTypes]         = useState({ ...BASE_COLUMN_TYPES });
  const [selectedColumns, setSelectedColumns] = useState(Object.keys(BASE_COLUMN_TYPES));
  const [allAvailableColumns, setAllAvailableColumns] = useState({ ...BASE_COLUMN_TYPES });
  const [loading, setLoading]                 = useState(false);
  const [qaLoading, setQaLoading]             = useState(false);
  const [totalCount, setTotalCount]           = useState(null);
  const [exportError, setExportError]         = useState(null);
  const [dataVersion, setDataVersion]         = useState(0);
  const [qaByBookingId, setQaByBookingId]     = useState({});
  const previousColumnTypes                   = useRef({});

  // Sync occupancy columns into selectedColumns and columnTypes when flag changes
  useEffect(() => {
    if (showOccupancy) {
      setColumnTypes(prev => ({ ...prev, ...OCCUPANCY_COLUMN_TYPES }));
      setAllAvailableColumns(prev => ({ ...prev, ...OCCUPANCY_COLUMN_TYPES }));
      setSelectedColumns(prev => {
        const base = prev.filter(c => !Object.keys(OCCUPANCY_COLUMN_TYPES).includes(c));
        return [...base, ...Object.keys(OCCUPANCY_COLUMN_TYPES)];
      });
    } else {
      setColumnTypes(prev => {
        const next = { ...prev };
        Object.keys(OCCUPANCY_COLUMN_TYPES).forEach(k => delete next[k]);
        return next;
      });
      setAllAvailableColumns(prev => {
        const next = { ...prev };
        Object.keys(OCCUPANCY_COLUMN_TYPES).forEach(k => delete next[k]);
        return next;
      });
      setSelectedColumns(prev => prev.filter(c => !Object.keys(OCCUPANCY_COLUMN_TYPES).includes(c)));
    }
  }, [showOccupancy]);

  // Phase 1: fetch base columns — fast, no QaPairs
  const fetchData = async () => {
    setLoading(true);
    setQaByBookingId({});
    const params = new URLSearchParams();
    if (startDate)        params.set('startDate', startDate);
    if (endDate)          params.set('endDate', endDate);
    if (dateFilterMode)   params.set('dateField', dateFilterMode);
    if (showOccupancy)    params.set('occupancy', 'true');

    try {
      const res = await fetch(`/api/reports/booking-reports?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const { bookings: data, totalCount: count } = await res.json();
      setTotalCount(count);

      const processedData = data.map(booking => {
        const row = {
          _id:            booking.id,
          BOOKING:        booking.reference_id || '',
          GUEST:          booking.Guest
            ? `${booking.Guest.first_name || ''} ${booking.Guest.last_name || ''}`.trim()
            : '',
          BOOKING_TYPE:   booking.type || '',
          CREATED:        booking.createdAt ? moment(booking.createdAt).format('DD-MM-YYYY') : '',
          STATUS:         processAnswer(booking.status),
          ELIGIBILITY:    processAnswer(booking.eligibility),
          // Always available from the booking model — no QA fetch needed
          CHECK_IN_DATE:  booking.preferred_arrival_date
            ? moment(booking.preferred_arrival_date).format('DD-MM-YYYY') : '—',
          CHECK_OUT_DATE: booking.preferred_departure_date
            ? moment(booking.preferred_departure_date).format('DD-MM-YYYY') : '—',
        };
        if (showOccupancy) {
          row.DATES_OF_STAY    = booking.DATES_OF_STAY    || '—';
          row.FUNDER           = booking.FUNDER           || '—';
          row.NIGHTS_IN_PERIOD = booking.NIGHTS_IN_PERIOD ?? 0;
        }
        return row;
      });

      const baseColTypes = showOccupancy
        ? { ...BASE_COLUMN_TYPES, ...OCCUPANCY_COLUMN_TYPES }
        : { ...BASE_COLUMN_TYPES };

      // Merge new base columns into existing column types — preserve any loaded QA cols
      setColumnTypes(prev => ({ ...baseColTypes, ...Object.fromEntries(Object.entries(prev).filter(([k]) => k.startsWith('q_'))) }));
      setAllAvailableColumns(prev => ({ ...baseColTypes, ...Object.fromEntries(Object.entries(prev).filter(([k]) => k.startsWith('q_'))) }));
      // Preserve selected QA columns that were already loaded — only reset to base if none loaded
      setSelectedColumns(prev => {
        const baseKeys = Object.keys(baseColTypes);
        const validQaKeys = prev.filter(k => k.startsWith('q_') && qaByBookingId && Object.keys(qaByBookingId).length > 0);
        // Keep existing base columns the user had selected, add any new base cols not yet in selection
        const existingBase = prev.filter(k => baseKeys.includes(k));
        const newBase = baseKeys.filter(k => !prev.includes(k) && k !== 'CHECK_OUT_DATE'); // don't auto-add checkout
        return [...new Set([...existingBase, ...newBase, ...validQaKeys])];
      });
      setBookings(processedData);
      setDataVersion(v => v + 1);
    } catch (err) {
      console.error('Booking list fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Phase 2: QaPair columns — loaded on demand via ColumnSelector "More +"
  const fetchQaColumns = async () => {
    if (qaLoading) return;
    setQaLoading(true);
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate)   params.set('endDate', endDate);
    if (dateFilterMode) params.set('dateField', dateFilterMode);

    try {
      const res = await fetch(`/api/reports/booking-qa-columns?${params}`);
      if (!res.ok) throw new Error('Failed to fetch QA columns');
      const { qaByBookingId: qaData, availableColumns } = await res.json();

      const newColTypes = {};
      availableColumns.forEach(col => { newColTypes[col.key] = col.label; });

      setQaByBookingId(qaData);
      setAllAvailableColumns(prev => ({ ...prev, ...newColTypes }));
      setColumnTypes(prev => ({ ...prev, ...newColTypes }));

      setBookings(prev => prev.map(row => {
        const qa = qaData[row._id] || {};
        const merged = { ...row };
        availableColumns.forEach(col => {
          // qaData now stores {answer, question_type} objects — unpack both
          const entry = qa[col.label];
          const answer = entry?.answer ?? entry ?? '';
          const qType  = entry?.question_type ?? col.questionType ?? '';
          merged[col.key] = processAnswer(answer, qType);
        });
        return merged;
      }));
    } catch (err) {
      console.error('QA columns fetch error:', err);
    } finally {
      setQaLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [startDate, endDate, dateFilterMode, showOccupancy]);

  const isStatusOrEligibility = (col) => {
    // Explicitly exclude date columns — they contain date strings not status values
    if (['CHECK_IN_DATE', 'CHECK_OUT_DATE', 'CREATED', 'DATES_OF_STAY'].includes(col)) return false;
    const name  = col.toLowerCase();
    const label = (columnTypes[col] || '').toLowerCase();
    return name === 'status' || label.includes('status') || name === 'eligibility' || label.includes('eligibility');
  };

  const renderCell = (col, value) => {
    if (isStatusOrEligibility(col)) {
      const { type, label } = getStatusBadgeProps(value);
      return <StatusBadge type={type} label={label} fullWidth />;
    }
    if (col === 'NIGHTS_IN_PERIOD') return <span className="font-medium tabular-nums">{value ?? 0}</span>;
    return value || '—';
  };

  return (
    <div>
      <div className="flex justify-between items-start mb-4">
        <ColumnSelector
          availableColumns={allAvailableColumns}
          selectedColumns={selectedColumns}
          isLoadingColumns={qaLoading}
          onOpen={fetchQaColumns}
          onColumnToggle={col => setSelectedColumns(prev => [...prev, col])}
          onColumnHide={col => setSelectedColumns(prev => prev.filter(c => c !== col))}
          onReorder={(from, to) => {
            const result = Array.from(selectedColumns);
            const [removed] = result.splice(from, 1);
            result.splice(to, 0, removed);
            setSelectedColumns(result);
          }}
        />
        <div className="flex items-center gap-3 flex-shrink-0">
          {totalCount !== null && !loading && (
            <span className="text-sm text-gray-500">
              <strong className="text-gray-800">{totalCount.toLocaleString()}</strong> results
              <span className="ml-1 text-gray-400">
                (by {DATE_FILTER_MODES.find(m => m.value === dateFilterMode)?.label || 'Created Date'})
              </span>
            </span>
          )}
          <ExportButton
            data={bookings}
            columns={selectedColumns}
            columnTypes={columnTypes}
            startDate={startDate}
            endDate={endDate}
            dateField={dateFilterMode}
            occupancy={showOccupancy}
            onExportStart={() => setExportError(null)}
            onExportComplete={() => {}}
            onExportError={err => setExportError(err.message)}
          />
        </div>
      </div>

      {exportError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">{exportError}</div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-16"><Spinner /></div>
      ) : (
        <PaginatedTable
          columns={selectedColumns}
          data={bookings}
          columnTypes={columnTypes}
          dataVersion={dataVersion}
          renderCell={renderCell}
        />
      )}
    </div>
  );
};

// ─── Page Shell ───────────────────────────────────────────────────────────────

const ReportConfig = () => {
  const dispatch = useDispatch();
  const [startDate, setStartDate]         = useState('');
  const [endDate, setEndDate]             = useState('');
  const [dateFilterMode, setDateFilterMode] = useState('created_at');
  const [showOccupancy, setShowOccupancy] = useState(false);

  useEffect(() => { dispatch(globalActions.setLoading(false)); }, []);

  return (
    <Layout title="Reports">
      <div className="p-8 col-span-9">

        {/* Title Bar */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-neutral-darker uppercase">REPORTS</h1>

          <div className="flex items-center gap-3">
            <DateFilterModeSelector value={dateFilterMode} onChange={setDateFilterMode} />
            <DateRangeFilter
              onFilterChange={(start, end) => { setStartDate(start); setEndDate(end); }}
              onClear={() => { setStartDate(''); setEndDate(''); }}
              dateFilterMode={dateFilterMode}
            />
          </div>
        </div>

        {/* Occupancy Toggle */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          <button
            onClick={() => setShowOccupancy(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              showOccupancy
                ? 'bg-sea text-white border-sea'
                : 'bg-white text-gray-600 border-gray-300 hover:border-sea hover:text-sea'
            }`}
          >
            {showOccupancy
              ? <ToggleRight className="w-4 h-4" />
              : <ToggleLeft className="w-4 h-4" />}
            Occupancy Columns
          </button>
          {showOccupancy && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Showing Dates of Stay, Funder, and Nights in Period
            </span>
          )}
        </div>

        <BookingListReport
          startDate={startDate}
          endDate={endDate}
          dateFilterMode={dateFilterMode}
          showOccupancy={showOccupancy}
        />

      </div>
    </Layout>
  );
};

export default ReportConfig;