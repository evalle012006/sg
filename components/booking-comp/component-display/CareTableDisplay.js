import React from 'react';

const CareTableDisplay = ({ data, oldData }) => {
  if (!data || !data.formatted || !data.dates) {
    return <pre className="whitespace-pre-wrap font-sans text-sm">{String(data)}</pre>;
  }
  
  const hasChanges = data.detailedChanges && data.detailedChanges.length > 0;
  
  if (!hasChanges) {
    return (
      <div className="care-table bg-gray-50 p-3 rounded-md">
        {data.dates.map((dateItem, dateIndex) => (
          <div key={dateIndex} className="mb-4">
            <div className="font-bold border-b pb-1 mb-2">{dateItem.date}</div>
            
            {dateItem.periods.morning && (
              <div className="ml-4 flex items-center mb-1">
                <span className="text-yellow-500 mr-2">☀️</span>
                <span>Morning: {dateItem.periods.morning.time} ({dateItem.periods.morning.duration}) - {dateItem.periods.morning.carers} carer(s)</span>
              </div>
            )}
            
            {dateItem.periods.afternoon && (
              <div className="ml-4 flex items-center mb-1">
                <span className="text-orange-500 mr-2">🌤️</span>
                <span>Afternoon: {dateItem.periods.afternoon.time} ({dateItem.periods.afternoon.duration}) - {dateItem.periods.afternoon.carers} carer(s)</span>
              </div>
            )}
            
            {dateItem.periods.evening && (
              <div className="ml-4 flex items-center mb-1">
                <span className="text-blue-900 mr-2">🌙</span>
                <span>Evening: {dateItem.periods.evening.time} ({dateItem.periods.evening.duration}) - {dateItem.periods.evening.carers} carer(s)</span>
              </div>
            )}
          </div>
        ))}
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