'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('email_trigger_questions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      email_trigger_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'email_triggers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      question_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'questions', // Adjust this table name if different
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      answer: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'The selected answer value for this question'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('email_trigger_questions', ['email_trigger_id']);
    await queryInterface.addIndex('email_trigger_questions', ['question_id']);
    
    // Add unique constraint to prevent duplicate question assignments
    await queryInterface.addIndex('email_trigger_questions', 
      ['email_trigger_id', 'question_id'], 
      {
        unique: true,
        name: 'email_trigger_questions_unique'
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('email_trigger_questions');
  }
};