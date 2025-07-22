'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('checklist_actions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      action: {
        type: Sequelize.TEXT
      },
      status: {
        type: Sequelize.BOOLEAN
      },
      checklist_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'checklists', key: 'id'
        }
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('checklist_actions');
  }
};