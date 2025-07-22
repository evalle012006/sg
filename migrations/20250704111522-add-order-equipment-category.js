'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('equipment_categories', 'order', {
      allowNull: false,
      type: Sequelize.INTEGER,
      defaultValue: 0
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('equipment_categories', 'order');
  }
};