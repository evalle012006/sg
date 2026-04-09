import React from 'react';

// ── Helper: build dateGroups with arrays per period so multiple entries
// (e.g. two morning sessions from additional care lines) are all shown.
const buildDateGroups = (careDataArray) => {
  const dateGroups = {};
  careDataArray.forEach(item => {
    if (!item.date) return;
    if (!dateGroups[item.date]) {
      dateGroups[item.date] = { morning: [], afternoon: [], evening: [] };
    }
    if (item.care && dateGroups[item.date][item.care] !== undefined) {
      dateGroups[item.date][item.care].push({
        ...(item.values || {}),
        isAdditional: item.isAdditional || false,
      });
    }
  });
  return dateGroups;
};

// ── Render a single period cell: one or more entries stacked vertically.
const PeriodEntries = ({ entries }) => {
  if (!entries || entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      {entries.map((entry, idx) => (
        <div
          key={idx}
          className={entry.isAdditional
            ? 'text-blue-700 text-xs pl-1 border-l-2 border-blue-300'
            : 'text-sm'}
        >
          {entry.time} ({entry.duration}) — {entry.carers} carer(s)
          {entry.isAdditional && (
            <span className="ml-1 text-xs text-blue-400 italic">(extra)</span>
          )}
        </div>
      ))}
    </div>
  );
};

const CareTableDisplay = ({ data, oldData }) => {
  if (!data || !data.formatted || !data.dates) {
    return <pre className="whitespace-pre-wrap font-sans text-sm">{String(data)}</pre>;
  }
  
  let processedData = data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (data.careData && Array.isArray(data.careData)) {
      processedData = { ...data, formatted: data.careData, dates: data.dates };
    }
  }
  
  if (!processedData || !processedData.formatted || !processedData.dates) {
    return <pre className="whitespace-pre-wrap font-sans text-sm">{String(data)}</pre>;
  }
  
  const hasChanges = processedData.detailedChanges && processedData.detailedChanges.length > 0;
  
  if (!hasChanges) {
    return (
      <div className="care-table bg-gray-50 p-3 rounded-md">
        {data.dates.map((dateItem, dateIndex) => {
          // ── NEW: dateItem.periods.morning is now an array ─────────────────
          const morningEntries = Array.isArray(dateItem.periods.morning)
            ? dateItem.periods.morning
            : dateItem.periods.morning ? [dateItem.periods.morning] : [];
          const afternoonEntries = Array.isArray(dateItem.periods.afternoon)
            ? dateItem.periods.afternoon
            : dateItem.periods.afternoon ? [dateItem.periods.afternoon] : [];
          const eveningEntries = Array.isArray(dateItem.periods.evening)
            ? dateItem.periods.evening
            : dateItem.periods.evening ? [dateItem.periods.evening] : [];
          // ──────────────────────────────────────────────────────────────────

          return (
            <div key={dateIndex} className="mb-4">
              <div className="font-bold border-b pb-1 mb-2">{dateItem.date}</div>
              
              {morningEntries.length > 0 && (
                <div className="ml-4 flex items-start mb-1 gap-2">
                  <span className="text-yellow-500 mt-0.5">☀️</span>
                  <div>
                    <span className="font-medium text-sm">Morning: </span>
                    <PeriodEntries entries={morningEntries} />
                  </div>
                </div>
              )}
              
              {afternoonEntries.length > 0 && (
                <div className="ml-4 flex items-start mb-1 gap-2">
                  <span className="text-orange-500 mt-0.5">🌤️</span>
                  <div>
                    <span className="font-medium text-sm">Afternoon: </span>
                    <PeriodEntries entries={afternoonEntries} />
                  </div>
                </div>
              )}
              
              {eveningEntries.length > 0 && (
                <div className="ml-4 flex items-start mb-1 gap-2">
                  <span className="text-blue-900 mt-0.5">🌙</span>
                  <div>
                    <span className="font-medium text-sm">Evening: </span>
                    <PeriodEntries entries={eveningEntries} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  
  // Show changes highlighting logic from old component
  const changesByDate = {};
  data.detailedChanges.forEach(change => {
    if (!changesByDate[change.date]) {
      changesByDate[change.date] = [];
    }
    changesByDate[change.date].push(change);
  });
  
  const getPeriodIcon = (period, isOld = false) => {
    if (period === 'morning') {
      return <span className={`${isOld ? 'text-gray-400' : 'text-yellow-500'} mr-2`}>☀️</span>;
    } else if (period === 'afternoon') {
      return <span className={`${isOld ? 'text-gray-400' : 'text-orange-500'} mr-2`}>🌤️</span>;
    } else if (period === 'evening') {
      return <span className={`${isOld ? 'text-gray-400' : 'text-blue-900'} mr-2`}>🌙</span>;
    }
    return null;
  };
  
  const formatCareValue = (value) => {
    if (!value) return 'None';
    return `${value.time} (${value.duration}) - ${value.carers} carer(s)`;
  };
  
  const getChangeLabel = (type) => {
    if (type === 'ADDED') {
      return <span className="ml-2 text-green-600 text-xs">[ADDED]</span>;
    } else if (type === 'REMOVED') {
      return <span className="ml-2 text-red-600 text-xs">[REMOVED]</span>;
    } else if (type === 'CHANGED') {
      return <span className="ml-2 text-orange-600 text-xs">[CHANGED]</span>;
    }
    return null;
  };
  
  return (
    <div className="care-table bg-gray-50 p-3 rounded-md">
      {Object.entries(changesByDate).map(([date, changes], dateIndex) => (
        <div key={dateIndex} className="mb-4">
          <div className="font-bold border-b pb-1 mb-2">{date}</div>
          
          {changes.map((change, changeIndex) => (
            <div key={changeIndex} className="ml-4 mb-3">
              <div className="font-medium capitalize mb-1">
                {change.period}:
                {change.isAdditional && <span className="ml-1 text-xs text-blue-500">(extra)</span>}
                {getChangeLabel(change.type)}
              </div>
              
              {change.type === 'CHANGED' && (
                <>
                  <div className="flex items-center ml-4 line-through text-gray-500 mb-1">
                    {getPeriodIcon(change.period, true)}
                    <span>Old: {formatCareValue(change.oldValue)}</span>
                  </div>
                  <div className="flex items-center ml-4 font-medium">
                    {getPeriodIcon(change.period)}
                    <span>New: {formatCareValue(change.newValue)}</span>
                  </div>
                </>
              )}
              
              {change.type === 'ADDED' && (
                <div className="flex items-center ml-4 font-medium text-green-700">
                  {getPeriodIcon(change.period)}
                  <span>{formatCareValue(change.newValue)}</span>
                </div>
              )}
              
              {change.type === 'REMOVED' && (
                <div className="flex items-center ml-4 line-through text-gray-500">
                  {getPeriodIcon(change.period, true)}
                  <span>{formatCareValue(change.oldValue)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default CareTableDisplay;