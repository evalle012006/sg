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
      comment: 'DEPRECATED: Use EmailTriggerQuestion association instead',
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
    trigger_context: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'System trigger event key, e.g. booking_status_changed'
    },
    context_conditions: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional filter conditions for system triggers',
      get() {
        const rawValue = this.getDataValue('context_conditions');
        if (!rawValue) return null;
        return rawValue;
      }
    },
    data_mapping: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Custom data mapping overrides for system triggers',
      get() {
        const rawValue = this.getDataValue('data_mapping');
        if (!rawValue) return null;
        return rawValue;
      }
    },
    // ✨ Added: 'system' to the ENUM
    type: {
      type: DataTypes.ENUM('highlights', 'external', 'internal', 'system'),
      allowNull: true
    },
    // ✨ Added: description and priority
    description: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Human-readable description of what this trigger does'
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      comment: '1-10, lower number = higher priority'
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