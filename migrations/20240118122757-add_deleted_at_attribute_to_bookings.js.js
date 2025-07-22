'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("bookings", "deleted_at", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("bookings", "deleted_at");
  },
};
