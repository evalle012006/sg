'use strict';

/**
 * OPTIONAL MIGRATION: Drop unused tables
 * 
 * Run this ONLY AFTER:
 * 1. The FK migration has been applied
 * 2. All code has been updated to use FundingApproval
 * 3. You've verified the system works correctly
 * 4. You've backed up any data you need from guest_approvals
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Drop the junction table first (depends on guest_approvals)
    await queryInterface.dropTable('guest_approval_funding_approvals');
    
    // Step 2: Drop the guest_approvals table
    await queryInterface.dropTable('guest_approvals');
    
    console.log('✅ Dropped guest_approval_funding_approvals and guest_approvals tables');
  },

  async down(queryInterface, Sequelize) {
    // Recreate guest_approvals table
    await queryInterface.createTable('guest_approvals', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      guest_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'guests',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      approval_name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      approval_number: {
        type: Sequelize.STRING,
        allowNull: true
      },
      approval_type: {
        type: Sequelize.ENUM('icare', 'ndis', 'private', 'other'),
        defaultValue: 'icare',
        allowNull: false
      },
      nights_approved: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      nights_used: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      package_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'packages',
          key: 'id'
        }
      },
      approval_from: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      approval_to: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      additional_room_approved: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'room_types',
          key: 'id'
        }
      },
      additional_room_nights_approved: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: true
      },
      additional_room_nights_used: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('active', 'expired', 'exhausted', 'cancelled'),
        defaultValue: 'active',
        allowNull: false
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Recreate junction table
    await queryInterface.createTable('guest_approval_funding_approvals', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
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
      funding_approval_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'funding_approvals',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      nights_allocated: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      additional_room_nights_allocated: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add indexes
    await queryInterface.addIndex('guest_approvals', ['guest_id']);
    await queryInterface.addIndex('guest_approvals', ['package_id']);
    await queryInterface.addIndex('guest_approvals', ['status']);
    await queryInterface.addIndex('guest_approvals', ['approval_from', 'approval_to']);
  }
};