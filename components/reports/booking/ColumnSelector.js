import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Search } from 'lucide-react';

const ColumnSelector = ({ availableColumns, selectedColumns, onColumnToggle, onReorder, onColumnHide }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    onReorder(result.source.index, result.destination.index);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredColumns = Object.entries(availableColumns)
    .filter(([key, value]) => 
      !selectedColumns.includes(key) && 
      value.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="columns" direction="horizontal">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="mb-4 relative flex flex-wrap gap-2 items-center">
            {selectedColumns.map((key, index) => (
              <Draggable key={key} draggableId={key} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`px-3 py-1 rounded border ${snapshot.isDragging ? 'bg-blue-200' : 'bg-blue-100'} border-blue-500 flex items-center`}
                  >
                    <span className="mr-2">{truncateString(availableColumns[key], 50)}</span>
                    <button
                      onClick={() => onColumnHide(key)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ×
                    </button>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="px-3 py-1 rounded border bg-gray-100 border-gray-300"
              >
                More +
              </button>
              {showDropdown && (
                <div className="absolute z-10 mt-2 w-96 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                  <div className="p-2">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search columns..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-8 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <Search className="absolute left-2 top-2.5 h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                  <div className="py-1 max-h-60 overflow-y-auto" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                    {filteredColumns.length > 0 ? (
                      filteredColumns.map(([key, value]) => (
                        <button
                          key={key}
                          onClick={() => {
                            onColumnToggle(key);
                            setSearchTerm('');
                          }}
                          className="block px-4 py-2 text-sm w-full text-left text-gray-700 hover:bg-gray-100"
                          role="menuitem"
                          title={value}
                        >
                          {truncateString(value, 50)}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-sm text-gray-500">
                        No columns found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

export default ColumnSelector;

const truncateString = (str, num) => {
    if (str.length <= num) {
      return str;
    }
    return str.slice(0, num) + '...';
};