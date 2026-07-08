'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('packages', 'is_active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('packages', 'is_active');
  },
};