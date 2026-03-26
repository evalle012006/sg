import React, { useState, useEffect, useRef } from 'react';

/**
 * Searchable dropdown for selecting a trigger event
 * Similar UX to QuestionSearchDropdown but for system trigger events
 */
const TriggerEventSearchDropdown = ({ 
  events, 
  eventsByEntity,
  value, 
  onChange, 
  disabled 
}) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedEvent = events.find(e => e.value === value);

  // Filter events by search term
  const filtered = search.trim()
    ? events.filter(e =>
        e.label?.toLowerCase().includes(search.toLowerCase()) ||
        e.description?.toLowerCase().includes(search.toLowerCase()) ||
        e.entityLabel?.toLowerCase().includes(search.toLowerCase())
      )
    : events;

  // Group filtered events by entity
  const groupedFiltered = {};
  filtered.forEach(event => {
    if (!groupedFiltered[event.entity]) {
      groupedFiltered[event.entity] = [];
    }
    groupedFiltered[event.entity].push(event);
  });

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (event) => {
    onChange(event.value);
    setSearch('');
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null);
    setSearch('');
  };

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={handleOpen}
        className={`w-full p-2 border rounded flex items-center justify-between cursor-pointer
          ${open ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-300 hover:border-blue-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'bg-white'}`}
      >
        <div className="flex-1 min-w-0">
          {selectedEvent ? (
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">{selectedEvent.entityIcon}</span>
                <span className="text-sm font-medium text-gray-900">{selectedEvent.label}</span>
              </div>
              <span className="text-xs text-gray-500 ml-7">{selectedEvent.description}</span>
            </div>
          ) : (
            <span className="text-gray-400 text-sm">-- Select a trigger event --</span>
          )}
        </div>
        <div className="flex items-center space-x-1 ml-2">
          {selectedEvent && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-red-500 transition-colors p-0.5 rounded"
              title="Clear selection"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search Header */}
          <div className="p-2 border-b border-gray-100 bg-gray-50 sticky top-0">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search trigger events..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1 px-0.5">
              {filtered.length} of {events.length} events
            </p>
          </div>

          {/* Events List */}
          <ul className="max-h-96 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="p-3 text-sm text-gray-500 text-center italic">
                No events match &quot;{search}&quot;
              </li>
            ) : (
              Object.entries(groupedFiltered).map(([entityKey, entityEvents]) => {
                const entityInfo = eventsByEntity[entityKey];
                if (!entityInfo) return null;

                return (
                  <li key={entityKey}>
                    {/* Entity Group Header */}
                    <div className="sticky top-0 bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <span>{entityInfo.icon}</span>
                        <span>{entityInfo.label}</span>
                        <span className="ml-auto text-gray-500 font-normal">
                          {entityEvents.length}
                        </span>
                      </div>
                    </div>

                    {/* Entity Events */}
                    <ul className="divide-y divide-gray-50">
                      {entityEvents.map(event => {
                        const isSelected = event.value === value;

                        return (
                          <li
                            key={event.value}
                            onClick={() => handleSelect(event)}
                            className={`px-3 py-2.5 cursor-pointer transition-colors
                              ${isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-blue-50 border-l-2 border-transparent'}
                            `}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm leading-snug text-gray-900">
                                  {event.label}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                  {event.description}
                                </div>
                                {event.availableConditions?.length > 0 && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <span className="text-xs text-blue-600">
                                      {event.availableConditions.length} condition{event.availableConditions.length !== 1 ? 's' : ''} available
                                    </span>
                                  </div>
                                )}
                              </div>
                              {isSelected && (
                                <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TriggerEventSearchDropdown;