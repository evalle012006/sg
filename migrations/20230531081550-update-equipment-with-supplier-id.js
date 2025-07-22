'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.addColumn('equipments', 'supplier_id', {
          type: Sequelize.INTEGER,
          references: {
            model: 'supplier',
            key: 'id',
          },
        }, { transaction: t }),
        queryInterface.removeColumn('equipments', 'supplier', { transaction: t })
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
