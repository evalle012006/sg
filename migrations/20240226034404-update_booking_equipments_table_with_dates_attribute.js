'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('booking_equipments', 'start_date', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('booking_equipments', 'end_date', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('booking_equipments', 'start_date');
    await queryInterface.removeColumn('booking_equipments', 'end_date');
  }
};
