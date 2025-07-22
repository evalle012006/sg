'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('email_triggers', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      recipient: {
        type: Sequelize.STRING
      },
      email_template: {
        type: Sequelize.STRING
      },
      trigger_questions: {
        type: Sequelize.JSON
      },
      type: {
        type: Sequelize.ENUM('highlights', 'external', 'internal')
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('email_triggers');
  }
};