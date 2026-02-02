'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class EmailTemplate extends Model {
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

    async countTriggers() {
      const EmailTrigger = sequelize.models.EmailTrigger;
      if (!EmailTrigger) {
        console.warn('EmailTrigger model not found');
        return 0;
      }
      
      return await EmailTrigger.count({
        where: { email_template_id: this.id }
      });
    }

    extractVariables() {
      const variableRegex = /\{\{([^}]+)\}\}/g;
      const variables = new Set();
      let match;

      const content = this.html_content || '';
      
      while ((match = variableRegex.exec(content)) !== null) {
        const fullMatch = match[1].trim();
        const varName = fullMatch.split(/\s+/)[0].replace(/^[#/^]/, '');
        
        if (varName && !['if', 'each', 'unless', 'with', 'else', 'lookup'].includes(varName)) {
          variables.add(varName);
        }
      }

      return Array.from(variables);
    }

    validateRequiredVariables() {
      if (!this.is_system || !this.required_variables || this.required_variables.length === 0) {
        return { valid: true, missing: [] };
      }

      const extractedVars = this.extractVariables();
      const missing = this.required_variables.filter(reqVar => !extractedVars.includes(reqVar));

      return {
        valid: missing.length === 0,
        missing: missing,
        extracted: extractedVars,
        required: this.required_variables
      };
    }

    async canBeDeleted() {
      if (this.is_system) {
        return {
          canDelete: false,
          reason: 'System templates cannot be deleted'
        };
      }

      const triggerCount = await this.countTriggers();
      if (triggerCount > 0) {
        return {
          canDelete: false,
          reason: `Template is being used by ${triggerCount} trigger(s)`
        };
      }

      return {
        canDelete: true,
        reason: null
      };
    }

    canBeDeactivated() {
      if (this.is_system) {
        return {
          canDeactivate: false,
          reason: 'System templates cannot be deactivated'
        };
      }

      return {
        canDeactivate: true,
        reason: null
      };
    }
  }
  
  EmailTemplate.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 255]
      }
    },
    template_code: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
      comment: 'Unique code identifier for system templates (e.g., booking-confirmed)'
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
    is_system: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'System templates cannot be deleted but can be modified'
    },
    required_variables: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'List of required template variables that must be preserved',
      get() {
        const rawValue = this.getDataValue('required_variables');
        if (!rawValue) return [];
        if (typeof rawValue === 'string') {
          try {
            return JSON.parse(rawValue);
          } catch (error) {
            console.error('Error parsing required_variables:', error);
            return [];
          }
        }
        return rawValue;
      }
    },
    variable_description: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Description of what each variable is used for',
      get() {
        const rawValue = this.getDataValue('variable_description');
        if (!rawValue) return {};
        if (typeof rawValue === 'string') {
          try {
            return JSON.parse(rawValue);
          } catch (error) {
            console.error('Error parsing variable_description:', error);
            return {};
          }
        }
        return rawValue;
      }
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
    timestamps: false, // ✅ CHANGED: Disable automatic timestamps
    underscored: true
  });
  
  return EmailTemplate;
};