'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('qa_pairs', {
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
      answer: {
        type: Sequelize.TEXT
      },
      question_type: {
        type: Sequelize.STRING
      },
      question_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'questions', key: 'id'
        }
      },
      section_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'sections', key: 'id'
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
    await queryInterface.dropTable('qa_pairs');
  }
};