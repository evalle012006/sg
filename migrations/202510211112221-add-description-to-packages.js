'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('packages', 'description', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'ndis_package_type'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('packages', 'description');
  }
};