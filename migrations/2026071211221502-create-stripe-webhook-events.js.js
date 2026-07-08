'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('stripe_webhook_events', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      event_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      event_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('stripe_webhook_events', ['event_id'], {
      unique: true,
      name: 'stripe_webhook_events_event_id_unique',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('stripe_webhook_events');
  },
};