'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('equipments', 'order', {
      allowNull: false,
      type: Sequelize.INTEGER,
      defaultValue: 0
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('equipments', 'order');
  }
};