'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.addColumn('equipments', 'category_id', {
          type: Sequelize.INTEGER,
          references: {
            model: 'equipment_categories',
            key: 'id',
          },
        }, { transaction: t }),
        queryInterface.removeColumn('equipments', 'category', { transaction: t })
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
