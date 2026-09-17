'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class QuestionAnswerPrompt extends Model {
    static associate(models) {
      QuestionAnswerPrompt.belongsTo(models.Question, { foreignKey: 'question_id' });
    }
  }
  QuestionAnswerPrompt.init({
    question_id: {
      type: DataTypes.INTEGER,
      references: { model: 'questions', key: 'id' }
    },
    trigger_answer: DataTypes.STRING,
    target_answer: DataTypes.STRING,
    modal_message: DataTypes.TEXT,
    confirm_label: { type: DataTypes.STRING, defaultValue: 'Yes' },
    cancel_label: { type: DataTypes.STRING, defaultValue: 'No' },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, {
    sequelize,
    modelName: 'QuestionAnswerPrompt',
    tableName: 'question_answer_prompts',
    underscored: true,
  });
  return QuestionAnswerPrompt;
};
