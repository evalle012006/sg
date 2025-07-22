'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Room extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
  }
  Room.init({
    order: DataTypes.INTEGER,
    label: DataTypes.STRING,
    checkin: DataTypes.DATE,
    checkout: DataTypes.DATE,
    arrival_time: DataTypes.STRING,
    total_guests: DataTypes.INTEGER,
    adults: DataTypes.INTEGER,
    children: DataTypes.INTEGER,
    infants: DataTypes.INTEGER,
    pets: DataTypes.INTEGER,
    guests: DataTypes.TEXT,
    booking_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'bookings', key: 'id'
      }
    },
    room_type_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'room_types', key: 'id'
      }
    }
  }, {
    sequelize,
    modelName: 'Room',
    tableName: 'rooms',
    underscored: true,
  });

  return Room;
};

async () => await Room.sync();