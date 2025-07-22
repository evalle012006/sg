'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.changeColumn('bookings', 'notes', {
          type: Sequelize.TEXT
        }, { transaction: t }),
        queryInterface.changeColumn('bookings', 'checklist_notes', {
          type: Sequelize.TEXT
        }, { transaction: t }),
      ]);
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  }
};
