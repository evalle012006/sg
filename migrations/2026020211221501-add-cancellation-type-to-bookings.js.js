'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('bookings', 'cancellation_type', {
      type: Sequelize.ENUM('no_charge', 'full_charge'),
      allowNull: true,
      defaultValue: null,
      comment: 'Type of cancellation charge: no_charge (nights returned) or full_charge (penalty applied)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('bookings', 'cancellation_type');
    // Also remove the ENUM type
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_bookings_cancellation_type";');
  }
};