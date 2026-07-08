'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('bookings', 'stripe_payment_intent', {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('bookings', 'stripe_payment_intent');
  }
};