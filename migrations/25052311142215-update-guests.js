'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.addColumn('guests', 'address_street1', {
          type: Sequelize.STRING,
          allowNull: false
        }, { transaction: t }),
        queryInterface.addColumn('guests', 'address_street2', {
          type: Sequelize.STRING,
          allowNull: false
        }, { transaction: t }),
        queryInterface.addColumn('guests', 'address_city', {
          type: Sequelize.STRING,
          allowNull: false
        }, { transaction: t }),
        queryInterface.addColumn('guests', 'address_state_province', {
          type: Sequelize.STRING,
          allowNull: false
        }, { transaction: t }),
        queryInterface.addColumn('guests', 'address_postal', {
          type: Sequelize.STRING,
          allowNull: false
        }, { transaction: t }),
        queryInterface.addColumn('guests', 'address_country', {
          type: Sequelize.STRING,
          allowNull: false
        }, { transaction: t }),
      ]);
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('checklist_templates', 'order');
  }
};