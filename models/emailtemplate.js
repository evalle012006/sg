'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class EmailTemplate extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Association with User (creator)
      EmailTemplate.belongsTo(models.User, {
        foreignKey: 'created_by',
        as: 'creator'
      });
      
      // Association with EmailTrigger
      EmailTemplate.hasMany(models.EmailTrigger, {
        foreignKey: 'email_template_id',
        as: 'triggers'
      });
    }
  }
  
  EmailTemplate.init({
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 255]
      }
    },
    subject: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    html_content: {
      type: DataTypes.TEXT('long'),
      allowNull: false
    },
    json_design: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('json_design');
        if (!rawValue) return null;
        try {
          return JSON.parse(rawValue);
        } catch (error) {
          console.error('Error parsing json_design:', error);
          return null;
        }
      },
      set(value) {
        if (value === null || value === undefined) {
          this.setDataValue('json_design', null);
        } else {
          this.setDataValue('json_design', JSON.stringify(value));
        }
      }
    },
    template_type: {
      type: DataTypes.ENUM('custom', 'system', 'migrated'),
      defaultValue: 'custom',
      allowNull: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    preview_image: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    sequelize,
    modelName: 'EmailTemplate',
    tableName: 'email_templates',
    underscored: true
  });
  
  return EmailTemplate;
};
