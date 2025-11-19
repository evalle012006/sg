'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('funding_approvals', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      approval_name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Friendly name for the approval (e.g., "iCare Winter 2024")'
      },
      approval_number: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Official approval reference number'
      },
      funding_type: {
        type: Sequelize.ENUM('icare', 'ndis', 'private', 'dva', 'other'),
        defaultValue: 'icare',
        allowNull: false
      },
      nights_approved: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      package_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'packages',
          key: 'id'
        },
        comment: 'Associated iCare package'
      },
      approval_from: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        comment: 'Start date of approval validity'
      },
      approval_to: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        comment: 'End date of approval validity'
      },
      additional_room_type_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'room_types',
          key: 'id'
        },
        comment: 'Additional room type approved'
      },
      additional_room_nights_approved: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'expired'),
        defaultValue: 'active',
        allowNull: false
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
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

    await queryInterface.addIndex('funding_approvals', ['funding_type']);
    await queryInterface.addIndex('funding_approvals', ['status']);
    await queryInterface.addIndex('funding_approvals', ['approval_from', 'approval_to']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('funding_approvals');
  }
};