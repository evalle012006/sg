'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class BookingEquipment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  BookingEquipment.init({
    equipment_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'equipments', key: 'id',
      },
    },
    booking_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'bookings', key: 'id',
      }
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    }
  }, {
    sequelize,
    modelName: 'BookingEquipment',
    tableName: 'booking_equipments',
    underscored: true,
  });
  return BookingEquipment;
};

async () => await BookingEquipment.sync();