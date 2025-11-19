'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('guest_approval_funding_approvals', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
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
        allowNull: false,
        comment: 'Nights allocated from this funding approval to the guest'
      },
      additional_room_nights_allocated: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
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

    await queryInterface.addIndex('guest_approval_funding_approvals', ['guest_approval_id']);
    await queryInterface.addIndex('guest_approval_funding_approvals', ['funding_approval_id']);
    
    await queryInterface.addConstraint('guest_approval_funding_approvals', {
      fields: ['guest_approval_id', 'funding_approval_id'],
      type: 'unique',
      name: 'unique_guest_funding_approval'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('guest_approval_funding_approvals');
  }
};