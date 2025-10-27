'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class EmailTrigger extends Model {}
  
  EmailTrigger.init({
    recipient: {
      type: DataTypes.STRING,
      allowNull: true
    },
    email_template: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Legacy template name - kept for backward compatibility'
    },
    email_template_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'email_templates',
        key: 'id'
      }
    },
    trigger_questions: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'DEPRECATED: Use questions association instead',
      get() {
        const rawValue = this.getDataValue('trigger_questions');
        if (!rawValue) return [];
        return rawValue;
      }
    },
    trigger_conditions: {
      type: DataTypes.JSON,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('trigger_conditions');
        if (!rawValue) return null;
        return rawValue;
      }
    },
    type: {
      type: DataTypes.ENUM('highlights', 'external', 'internal'),
      allowNull: true
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    last_triggered_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    trigger_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'EmailTrigger',
    tableName: 'email_triggers',
  });
  
  return EmailTrigger;
};