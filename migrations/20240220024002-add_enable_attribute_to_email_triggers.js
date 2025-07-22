'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('email_triggers', 'enabled', {
      type: Sequelize.BOOLEAN,
      defaultValue: true, // Add the defaultValue option here
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('email_triggers', 'enabled');
  }
};