'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('question_answer_prompts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      question_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'questions', key: 'id' },
        onDelete: 'CASCADE'
      },
      trigger_answer: {
        // matches the option's `value` (fallback `label`) that fires the modal
        type: Sequelize.STRING,
        allowNull: false
      },
      target_answer: {
        // value to switch this same question's answer to, on confirm
        type: Sequelize.STRING,
        allowNull: false
      },
      modal_message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      confirm_label: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Yes'
      },
      cancel_label: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'No'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE }
    });
    await queryInterface.addIndex('question_answer_prompts', ['question_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('question_answer_prompts');
  }
};
