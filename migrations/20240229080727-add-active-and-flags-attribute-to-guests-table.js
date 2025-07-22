'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('guests', 'active', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    });

    await queryInterface.addColumn('guests', 'flags', {
      type: Sequelize.JSON,
      defaultValue: [],
    });
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  }
};
