'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('checklist_templates', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING
      },
      actions: {
        type: Sequelize.JSON
      },
      template_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'templates', key: 'id'
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
    await queryInterface.dropTable('checklist_templates');
  }
};