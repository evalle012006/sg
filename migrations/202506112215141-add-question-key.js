'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add question_key column
    await queryInterface.addColumn('questions', 'question_key', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // Add non-unique index for better query performance
    await queryInterface.addIndex('questions', ['question_key'], {
      name: 'questions_question_key_idx'
    });

    // Add composite index for section_id and question_key for scoped uniqueness checks
    await queryInterface.addIndex('questions', ['section_id', 'question_key'], {
      name: 'questions_section_question_key_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('questions', 'questions_question_key_idx');
    await queryInterface.removeIndex('questions', 'questions_section_question_key_idx');
    
    // Remove column
    await queryInterface.removeColumn('questions', 'question_key');
  }
};