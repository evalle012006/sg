import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import moment from 'moment';
import dynamic from 'next/dynamic';

const Layout = dynamic(() => import('../../components/layout'));

export default function BookingAuditLogPage() {
  const router = useRouter();
  const { uuid } = router.query;
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [filter, setFilter] = useState({
    userType: 'all',
    category: 'all',
    actionType: 'all'
  });

  useEffect(() => {
    if (uuid) {
      fetchBooking();
      fetchAuditLogs();
    }
  }, [uuid]);

  const fetchBooking = async () => {
    try {
      const response = await fetch(`/api/bookings/${uuid}`);
      if (response.ok) {
        const data = await response.json();
        setBooking(data);
      }
    } catch (error) {
      console.error('Error fetching booking:', error);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        includeInternal: 'true',
        limit: '1000' // Get all logs
      });

      const response = await fetch(`/api/bookings/${uuid}/audit-log?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLogs(data.logs);
        }
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
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
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          Admin
        </span>
      ),
      guest: (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Guest
        </span>
      ),
      system: (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          System
        </span>
      )
    };
    return badges[userType] || badges.system;
  };

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (filter.userType !== 'all' && log.user_type !== filter.userType) return false;
    if (filter.category !== 'all' && log.category !== filter.category) return false;
    if (filter.actionType !== 'all' && log.action_type !== filter.actionType) return false;
    return true;
  });

  // Group logs by date
  const groupedLogs = filteredLogs.reduce((groups, log) => {
    const date = moment(log.created_at).format('YYYY-MM-DD');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(log);
    return groups;
  }, {});

  // Sort dates in descending order (newest first)
  const sortedDates = Object.keys(groupedLogs).sort((a, b) => 
    moment(b).valueOf() - moment(a).valueOf()
  );

  // Get unique categories and action types for filters
  const categories = [...new Set(logs.map(log => log.category).filter(Boolean))];
  const actionTypes = [...new Set(logs.map(log => log.action_type))];

  return (
    <Layout title="Booking Audit Log">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Booking History</h1>
              {booking && (
                <p className="text-sm text-gray-600 mt-1">
                  {booking.Guest?.first_name} {booking.Guest?.last_name} • 
                  Booking #{booking.id}
                </p>
              )}
            </div>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ← Back
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* User Type Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  User Type
                </label>
                <select
                  value={filter.userType}
                  onChange={(e) => setFilter({...filter, userType: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="admin">Admin</option>
                  <option value="guest">Guest</option>
                  <option value="system">System</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={filter.category}
                  onChange={(e) => setFilter({...filter, category: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Action Type Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Action
                </label>
                <select
                  value={filter.actionType}
                  onChange={(e) => setFilter({...filter, actionType: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Actions</option>
                  {actionTypes.map(action => (
                    <option key={action} value={action}>
                      {action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Results Count */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Showing {filteredLogs.length} of {logs.length} entries
              </p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Empty State */}
        {!loading && logs.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-3">
              <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
              </svg>
            </div>
            <p className="text-gray-500 text-lg font-medium">No activity recorded yet</p>
          </div>
        )}

        {/* Timeline */}
        {!loading && filteredLogs.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-200">
              {sortedDates.map((date) => (
                <div key={date} className="p-6">
                  {/* Date Header */}
                  <div className="flex items-center mb-4">
                    <div className="flex-1 border-t border-gray-300"></div>
                    <h3 className="px-4 text-sm font-semibold text-gray-700">
                      {moment(date).format('dddd, MMMM D, YYYY')}
                    </h3>
                    <div className="flex-1 border-t border-gray-300"></div>
                  </div>

                  {/* Logs for this date */}
                  <div className="space-y-4">
                    {groupedLogs[date].map((log, index) => (
                      <div key={log.id} className="flex gap-4">
                        {/* Timeline Line */}
                        <div className="flex flex-col items-center">
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl">
                            {getActionIcon(log.action_type)}
                          </div>
                          {index < groupedLogs[date].length - 1 && (
                            <div className="flex-1 w-0.5 bg-gray-200 my-1"></div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 pb-4">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="flex-1">
                              <p className="text-base text-gray-900 font-medium leading-tight">
                                {log.description}
                              </p>
                            </div>
                            <span className="flex-shrink-0 text-sm text-gray-500">
                              {moment(log.created_at).format('h:mm A')}
                            </span>
                          </div>

                          {/* Meta Information */}
                          <div className="flex items-center gap-3 mt-2">
                            {getUserTypeBadge(log.user_type)}
                            {log.actor && (
                              <span className="text-sm text-gray-600">
                                {log.actor.name}
                              </span>
                            )}
                            {log.category && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                {log.category}
                              </span>
                            )}
                          </div>

                          {/* Old/New Values (if available) */}
                          {(log.old_value || log.new_value) && (
                            <details className="mt-3">
                              <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                                View Details
                              </summary>
                              <div className="mt-2 p-3 bg-gray-50 rounded text-xs">
                                {log.old_value && (
                                  <div className="mb-2">
                                    <span className="font-medium text-gray-700">Previous:</span>
                                    <pre className="mt-1 text-gray-600 whitespace-pre-wrap">
                                      {JSON.stringify(log.old_value, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {log.new_value && (
                                  <div>
                                    <span className="font-medium text-gray-700">New:</span>
                                    <pre className="mt-1 text-gray-600 whitespace-pre-wrap">
                                      {JSON.stringify(log.new_value, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Results from Filter */}
        {!loading && logs.length > 0 && filteredLogs.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500">No entries match the selected filters</p>
            <button
              onClick={() => setFilter({ userType: 'all', category: 'all', actionType: 'all' })}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}