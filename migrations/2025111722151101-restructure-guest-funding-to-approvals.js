'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Rename table
    await queryInterface.renameTable('guest_funding', 'guest_approvals');
    
    // Add new fields
    await queryInterface.addColumn('guest_approvals', 'approval_name', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Friendly name for the approval (e.g., "2024 Winter Package")'
    });
    
    await queryInterface.addColumn('guest_approvals', 'approval_type', {
      type: Sequelize.ENUM('icare', 'ndis', 'private', 'other'),
      defaultValue: 'icare',
      allowNull: false
    });
    
    await queryInterface.addColumn('guest_approvals', 'status', {
      type: Sequelize.ENUM('active', 'expired', 'exhausted', 'cancelled'),
      defaultValue: 'active',
      allowNull: false
    });

    // Create booking-approval usage tracking table
    await queryInterface.createTable('booking_approval_usages', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      booking_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'bookings',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      guest_approval_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'guest_approvals',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      room_type: {
        type: Sequelize.ENUM('primary', 'additional'),
        defaultValue: 'primary',
        allowNull: false
      },
      nights_consumed: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('confirmed','late_cancelled','cancelled','charged'),
        defaultValue: 'confirmed',
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('booking_approval_usages', ['booking_id']);
    await queryInterface.addIndex('booking_approval_usages', ['guest_approval_id']);
    await queryInterface.addIndex('booking_approval_usages', ['status']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('booking_approval_usages');
    await queryInterface.removeColumn('guest_approvals', 'status');
    await queryInterface.removeColumn('guest_approvals', 'approval_type');
    await queryInterface.removeColumn('guest_approvals', 'approval_name');
    await queryInterface.renameTable('guest_approvals', 'guest_funding');
  }
};