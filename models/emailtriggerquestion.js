'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class EmailTriggerQuestion extends Model {}
  
  EmailTriggerQuestion.init({
    email_trigger_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'email_triggers',
        key: 'id'
      }
    },
    question_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'questions',
        key: 'id'
      }
    },
    answer: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'The selected answer value for this question'
    }
  }, {
    sequelize,
    modelName: 'EmailTriggerQuestion',
    tableName: 'email_trigger_questions',
    underscored: true
  });
  
  return EmailTriggerQuestion;
};