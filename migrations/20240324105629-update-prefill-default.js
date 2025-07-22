'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('questions', 'prefill', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('questions', 'prefill', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: null
    });
  }
};