'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class EquipmentCategory extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
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