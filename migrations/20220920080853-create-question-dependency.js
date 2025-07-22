'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('question_dependencies', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      question_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'questions',
          key: 'id'
        }
      },
      dependence_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'questions',
          key: 'id'
        }
      },
      answer: {
        type: Sequelize.STRING
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
    await queryInterface.dropTable('question_dependencies');
  }
};