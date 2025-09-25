'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  const BookingEquipment = sequelize.define('BookingEquipment', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    booking_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'bookings',
        key: 'id'
      }
    },
    equipment_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'equipments',
        key: 'id'
      }
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    meta_data: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'JSON field to store equipment-specific data like quantities, special requirements, etc.'
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE,
      field: 'created_at'
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE,
      field: 'updated_at'
    }
  }, {
    tableName: 'booking_equipments',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  BookingEquipment.associate = function(models) {
    BookingEquipment.belongsTo(models.Booking, {
      foreignKey: 'booking_id'
    });
    BookingEquipment.belongsTo(models.Equipment, {
      foreignKey: 'equipment_id'
    });
  };

  return BookingEquipment;
};

async () => await BookingEquipment.sync();