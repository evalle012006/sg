'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('booking_equipments', 'meta_data', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'JSON field to store equipment-specific data like quantities, special requirements, etc.'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('booking_equipments', 'meta_data');
  }
};