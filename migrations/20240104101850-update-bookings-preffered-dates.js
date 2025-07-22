'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    // update bookings.preferred_arrival_date and bookings.preferred_departure_date to be nullable
    await queryInterface.changeColumn('bookings', 'preferred_arrival_date', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.changeColumn('bookings', 'preferred_departure_date', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  }
};
