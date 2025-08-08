'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PackageRequirement extends Model {
    static associate(models) {
      // none
    }
  }
  
  PackageRequirement.init({
    package_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'packages',
        key: 'id'
      }
    },
    // Care requirements
    care_hours_min: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: 'Minimum care hours required (null = no minimum)'
    },
    care_hours_max: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: 'Maximum care hours allowed (null = no maximum)'
    },
    requires_no_care: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Package specifically requires no care'
    },
    // Course requirements
    requires_course: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
      comment: 'true = requires course, false = no course allowed, null = optional'
    },
    compatible_with_course: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether package can be combined with courses'
    },
    // Additional filters
    living_situation: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of compatible living situations: ["alone", "with_supports", "sil"]'
    },
    sta_requirements: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      comment: 'NDIS STA specific requirements: {requires_sta_in_plan: true/false}'
    },
    // Priority and visibility
    display_priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Display priority (higher numbers shown first)'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether this requirement rule is active'
    },
    // Metadata
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID of user who created this requirement'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Internal notes about this requirement rule'
    }
  }, {
    sequelize,
    modelName: 'PackageRequirement',
    tableName: 'package_requirements',
    timestamps: true,
    underscored: true, // Important: matches other models
    indexes: [
      {
        fields: ['package_id']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['display_priority']
      },
      {
        fields: ['care_hours_min', 'care_hours_max']
      }
    ]
  });
  
  return PackageRequirement;
};