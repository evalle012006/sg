'use strict';

/**
 * Migration to add indexes for notification query optimization
 * 
 * These indexes will significantly improve the performance of:
 * - Fetching notifications by user (notifyee_id, notifyee_type)
 * - Filtering by read status
 * - Sorting by created_at
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Index for fetching notifications by user
    await queryInterface.addIndex('notifications', 
      ['notifyee_id', 'notifyee_type'],
      {
        name: 'idx_notifications_notifyee',
        using: 'BTREE'
      }
    );

    // Composite index for filtering by read status
    await queryInterface.addIndex('notifications', 
      ['notifyee_id', 'notifyee_type', 'read'],
      {
        name: 'idx_notifications_notifyee_read',
        using: 'BTREE'
      }
    );

    // Index for sorting by created_at (for ORDER BY DESC)
    await queryInterface.addIndex('notifications', 
      ['created_at'],
      {
        name: 'idx_notifications_created_at',
        using: 'BTREE'
      }
    );

    // Composite index for the most common query pattern
    // (fetching unread notifications for a user, sorted by date)
    await queryInterface.addIndex('notifications', 
      ['notifyee_id', 'notifyee_type', 'read', 'created_at'],
      {
        name: 'idx_notifications_user_unread_date',
        using: 'BTREE'
      }
    );

    console.log('✅ Notification indexes created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('notifications', 'idx_notifications_notifyee');
    await queryInterface.removeIndex('notifications', 'idx_notifications_notifyee_read');
    await queryInterface.removeIndex('notifications', 'idx_notifications_created_at');
    await queryInterface.removeIndex('notifications', 'idx_notifications_user_unread_date');
    
    console.log('✅ Notification indexes removed successfully');
  }
};