'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Equipment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Define associations here if needed
      // this.belongsTo(models.EquipmentCategory, { foreignKey: 'category_id' });
      // this.belongsTo(models.Supplier, { foreignKey: 'supplier_id' });
    }
  }
  Equipment.init({
    name: DataTypes.STRING,
    type: DataTypes.STRING, //'independent' OR 'group' - 'independent' is a single equipment, 'group' is a group of equipments
    category_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'equipment_categories',        // mattress options, bed rails, ceiling hoist, etc.
        key: 'id',
      }
    },
    image_filename: DataTypes.STRING,
    serial_number: DataTypes.STRING,
    warranty_period: DataTypes.DATE,
    status: DataTypes.STRING,
    purchase_date: DataTypes.DATE,
    last_service_date: DataTypes.DATE,
    next_service_date: DataTypes.DATE,
    supplier_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'supplier',
        key: 'id'
      }
    },
    hidden: DataTypes.BOOLEAN,
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    sequelize,
    modelName: 'Equipment',
    tableName: 'equipments',
    underscored: true,
  });
  return Equipment;
};

async () => await Equipment.sync();