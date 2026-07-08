'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('bookings', 'booking_type', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: null,
      comment: 'Booking pathway: accommodation_only | funded | null (legacy/pre-AOB)',
      after: 'cancellation_type', // MySQL: places column at end of existing fields
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('bookings', 'booking_type');
  },
};