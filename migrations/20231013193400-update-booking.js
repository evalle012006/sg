'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.addColumn('bookings', 'eligibility', {
          type: Sequelize.STRING,
          defaultValue: JSON.stringify({ name: 'pending_approval', label: 'Pending Approval', color: 'yellow' })
        }, { transaction: t }),
        queryInterface.changeColumn('bookings', 'status', {
          type: Sequelize.STRING,
          defaultValue: JSON.stringify({ name: 'enquiry', label: 'Enquiry', color: 'gray' })
        }, { transaction: t }),
        queryInterface.addColumn('bookings', 'notes', {
          type: Sequelize.STRING
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
