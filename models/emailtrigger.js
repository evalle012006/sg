'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class EmailTrigger extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Association with EmailTemplate
      EmailTrigger.belongsTo(models.EmailTemplate, {
        foreignKey: 'email_template_id',
        as: 'template'
      });
    }
  }
  
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
      get() {
        const rawValue = this.getDataValue('trigger_questions');
        if (!rawValue) return [];
        // Already parsed by Sequelize for JSON type
        return rawValue;
      }
    },
    trigger_conditions: {
      type: DataTypes.JSON,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('trigger_conditions');
        if (!rawValue) return null;
        // Already parsed by Sequelize for JSON type
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