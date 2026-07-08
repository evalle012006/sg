'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class EquipmentCategory extends Model {
    static associate(models) {
      // Define associations here if needed
      // this.hasMany(models.Equipment, { foreignKey: 'category_id' });
    }
  }

  EquipmentCategory.init({
    name: DataTypes.STRING,
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    // ── NEW: display configuration columns ──────────────────────────────────
    //
    // display_type: replaces the hardcoded categoryName switch in
    //   determineCategoryTypes() in equipment.js.
    // is_required: replaces the hardcoded alwaysRequired / optionalCategories
    //   arrays in isRequiredCategory() in equipment.js.
    // custom_label: replaces the hardcoded label maps in
    //   getBinaryQuestionLabel() and getConfirmationQuestionLabel().
    // requires_confirmation: set automatically from display_type; kept as
    //   a column for convenience in queries.
    display_type: {
      type: DataTypes.ENUM(
        'binary',
        'single_select',
        'multi_select',
        'confirmation_single',
        'confirmation_multi',
        'special'
      ),
      allowNull: false,
      defaultValue: 'binary'
    },
    is_required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    custom_label: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: null
    },
    requires_confirmation: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    sequelize,
    modelName: 'EquipmentCategory',
    tableName: 'equipment_categories',
    underscored: true,
  });

  return EquipmentCategory;
};

async () => await EquipmentCategory.sync();