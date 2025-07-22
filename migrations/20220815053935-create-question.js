'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('questions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      label: {
        type: Sequelize.STRING
      },
      question: {
        type: Sequelize.TEXT
      },
      options: {
        type: Sequelize.JSON
      },
      order: {
        type: Sequelize.INTEGER
      },
      required: {
        type: Sequelize.BOOLEAN,
      },
      section_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'sections', key: 'id'
        }
      },
      type: {
        type: Sequelize.STRING
      },
      details: {
        type: Sequelize.JSON
      },
      has_not_available_option: {
        type: Sequelize.BOOLEAN,
      },
      second_booking_only: {
        type: Sequelize.BOOLEAN,
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
    await queryInterface.dropTable('questions');
  }
};