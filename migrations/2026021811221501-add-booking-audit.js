'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('booking_audit_logs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      booking_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'bookings',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true, // Nullable for system-generated entries
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      action_type: {
        type: Sequelize.ENUM(
          'booking_created',
          'booking_submitted',
          'booking_approved',
          'booking_rejected',
          'booking_cancelled',
          'dates_changed',
          'guest_details_changed',
          'accommodation_changed',
          'care_hours_changed',
          'funding_changed',
          'equipment_changed',
          'courses_changed',
          'dietary_requirements_changed',
          'admin_note_added',
          'amendment_submitted',
          'amendment_approved',
          'status_changed',
          'other'
        ),
        allowNull: false
      },
      user_type: {
        type: Sequelize.ENUM('guest', 'admin', 'system'),
        allowNull: false,
        defaultValue: 'system'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      old_value: {
        type: Sequelize.JSON, // Use JSON instead of JSONB for MySQL
        allowNull: true,
        comment: 'Previous state of the changed data'
      },
      new_value: {
        type: Sequelize.JSON, // Use JSON instead of JSONB for MySQL
        allowNull: true,
        comment: 'New state of the changed data'
      },
      metadata: {
        type: Sequelize.JSON, // Use JSON instead of JSONB for MySQL
        allowNull: true,
        comment: 'Additional context like IP address, user agent, etc.'
      },
      is_internal_note: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'True for admin notes, false for system-tracked changes'
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Custom category for grouping related changes'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for common queries
    await queryInterface.addIndex('booking_audit_logs', ['booking_id', 'created_at'], {
      name: 'idx_booking_audit_logs_booking_created'
    });
    
    await queryInterface.addIndex('booking_audit_logs', ['user_id'], {
      name: 'idx_booking_audit_logs_user'
    });
    
    await queryInterface.addIndex('booking_audit_logs', ['action_type'], {
      name: 'idx_booking_audit_logs_action_type'
    });
    
    await queryInterface.addIndex('booking_audit_logs', ['is_internal_note'], {
      name: 'idx_booking_audit_logs_internal_note'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('booking_audit_logs');
  }
};