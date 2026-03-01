import React, { useState, useEffect } from 'react';
import moment from 'moment';

const BookingAuditLog = ({ bookingUuid, userRole, compact = false, maxEntries = 10 }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [noteCategory, setNoteCategory] = useState('General');
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [totalLogs, setTotalLogs] = useState(0);

  useEffect(() => {
    if (bookingUuid) {
      fetchAuditLogs();
    }
  }, [bookingUuid]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        includeInternal: userRole === 'admin' ? 'true' : 'false',
        limit: maxEntries.toString()
      });

      const response = await fetch(`/api/bookings/${bookingUuid}/audit-log?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLogs(data.logs);
          setTotalLogs(data.total || data.logs.length);
        }
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      const response = await fetch(`/api/bookings/${bookingUuid}/add-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: newNote.trim(),
          category: noteCategory
        })
      });

      if (response.ok) {
        setNewNote('');
        setShowNoteForm(false);
        fetchAuditLogs();
      }
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleShowMore = () => {
    // Open full audit log page in new window
    window.open(`/bookings/${bookingUuid}/audit-log`, '_blank');
  };

  const getActionIcon = (actionType) => {
    const icons = {
      booking_submitted: '📤',
      booking_approved: '✅',
      booking_rejected: '❌',
      booking_cancelled: '🚫',
      dates_changed: '📅',
      accommodation_changed: '🏠',
      care_hours_changed: '⏰',
      equipment_changed: '🛏️',
      admin_note_added: '📝',
      amendment_submitted: '✏️',
      amendment_approved: '✔️',
      status_changed: '🔄',
      default: '📌'
    };
    return icons[actionType] || icons.default;
  };

  const getUserTypeBadge = (userType) => {
    const badges = {
      admin: (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
          Admin
        </span>
      ),
      guest: (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
          Guest
        </span>
      ),
      system: (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
          System
        </span>
      )
    };
    return badges[userType] || badges.system;
  };

  // Group logs by date
  const groupedLogs = logs.reduce((groups, log) => {
    const date = moment(log.created_at).format('YYYY-MM-DD');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(log);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedLogs).sort((a, b) => 
    moment(b).valueOf() - moment(a).valueOf()
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No activity recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add Note Button (Admin Only) */}
      {userRole === 'admin' && !showNoteForm && (
        <button
          onClick={() => setShowNoteForm(true)}
          className="w-full px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
        >
          + Add Note
        </button>
      )}

      {/* Add Note Form */}
      {showNoteForm && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <form onSubmit={handleAddNote} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={noteCategory}
                onChange={(e) => setNoteCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="General">General</option>
                <option value="Care">Care</option>
                <option value="Equipment">Equipment</option>
                <option value="Accommodation">Accommodation</option>
                <option value="Billing">Billing</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Note
              </label>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your note..."
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Add Note
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNoteForm(false);
                  setNewNote('');
                }}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-4">
        {sortedDates.map((date) => (
          <div key={date}>
            {/* Date Header */}
            <div className="flex items-center mb-2">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="px-3 text-xs font-medium text-gray-500">
                {moment(date).calendar(null, {
                  sameDay: '[Today]',
                  lastDay: '[Yesterday]',
                  lastWeek: 'dddd',
                  sameElse: 'DD/MM/YYYY'
                })}
              </span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>

            {/* Logs for this date */}
            <div className="space-y-3">
              {groupedLogs[date].map((log) => (
                <div key={log.id} className="flex gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg">
                    {getActionIcon(log.action_type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm text-gray-900 leading-tight">
                        {log.description}
                      </p>
                      <span className="flex-shrink-0 text-xs text-gray-500">
                        {moment(log.created_at).format('HH:mm')}
                      </span>
                    </div>
                    
                    {/* User Type Badge and Actor */}
                    <div className="flex items-center gap-2 mt-1">
                      {getUserTypeBadge(log.user_type)}
                      {log.actor && (
                        <span className="text-xs text-gray-600">
                          {log.actor.name}
                        </span>
                      )}
                    </div>

                    {/* Category Tag */}
                    {log.category && (
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs text-gray-600 bg-gray-100 rounded">
                        {log.category}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Show More Button */}
      {totalLogs > maxEntries && (
        <div className="pt-2 border-t border-gray-200">
          <button
            onClick={handleShowMore}
            className="w-full px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            Show More ({totalLogs - maxEntries} more entries)
          </button>
        </div>
      )}
    </div>
  );
};

export default BookingAuditLog;