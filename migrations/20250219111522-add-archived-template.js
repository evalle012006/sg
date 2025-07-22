'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('templates', 'archived', {
      allowNull: false,
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });
    await queryInterface.addColumn('templates', 'archived_date', {
      allowNull: true,
      type: Sequelize.DATE,
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
