'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.addColumn('notifications_library', 'alert_type', {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: null
        }, { transaction: t }),
        queryInterface.addColumn('notifications_library', 'enabled', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        }, { transaction: t })
      ]);
    });
  },

  down: async (queryInterface, Sequelize) => {
  }
};