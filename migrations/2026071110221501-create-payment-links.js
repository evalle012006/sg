// migrations/2026071110221501-create-payment-links.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('payment_links', {
      id:                    { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid:                  { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      booking_id:            { type: Sequelize.INTEGER, allowNull: false, references: { model: 'bookings', key: 'id' } },
      stripe_session_id:     { type: Sequelize.STRING(255), allowNull: true },
      stripe_payment_intent: { type: Sequelize.STRING(255), allowNull: true },
      amount_cents:          { type: Sequelize.INTEGER, allowNull: false }, // stored in cents, no floating point
      currency:              { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'aud' },
      status:                { type: Sequelize.ENUM('pending', 'paid', 'expired', 'cancelled','failed'), allowNull: false, defaultValue: 'pending' },
      expires_at:            { type: Sequelize.DATE, allowNull: false }, // 48h before checkin
      paid_at:               { type: Sequelize.DATE, allowNull: true },
      sent_at:               { type: Sequelize.DATE, allowNull: true }, // when payment email was sent
      created_at:            { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at:            { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('payment_links', ['booking_id']);
    await queryInterface.addIndex('payment_links', ['uuid']);
    await queryInterface.addIndex('payment_links', ['stripe_session_id']);
    await queryInterface.addIndex('payment_links', ['status']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('payment_links');
  }
};