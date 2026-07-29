'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('refunds', {
      id:                    { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid:                  { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      booking_id:            { type: Sequelize.INTEGER, allowNull: false, references: { model: 'bookings', key: 'id' } },
      payment_link_id:       { type: Sequelize.INTEGER, allowNull: true, references: { model: 'payment_links', key: 'id' } },
      stripe_refund_id:      { type: Sequelize.STRING(255), allowNull: true },
      stripe_payment_intent: { type: Sequelize.STRING(255), allowNull: false },
      amount_cents:          { type: Sequelize.INTEGER, allowNull: false },
      currency:              { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'aud' },
      status:                { type: Sequelize.ENUM('pending', 'succeeded', 'failed'), allowNull: false, defaultValue: 'pending' },
      reason:                { type: Sequelize.TEXT, allowNull: true },
      initiated_by_user_id:  { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
      created_at:            { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at:            { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('refunds', ['booking_id']);
    await queryInterface.addIndex('refunds', ['stripe_refund_id']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('refunds');
  },
};