// migrations/2026071110221502-add-payment-status-to-bookings.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('bookings', 'payment_status', {
      type: Sequelize.ENUM('unpaid', 'paid', 'refunded', 'failed', 'partially_refunded'),
      allowNull: true,
      defaultValue: null,  // null = not an AOB booking or payment not yet requested
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('bookings', 'payment_status');
  }
};