'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Flag extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // No FK associations — Flag.value is referenced loosely by
      // Guest.flags / Booking.label (JSON arrays of slug strings) and by
      // EmailTrigger.guest_flag_filter / booking_flag_filter, none of
      // which are foreign-keyed to this table.
    }
  }
  Flag.init({
    type: {
      type: DataTypes.ENUM('guest', 'booking'),
      allowNull: false,
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    acronym: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    color: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '#6B7280',
    },
  }, {
    sequelize,
    modelName: 'Flag',
    tableName: 'flags',
    underscored: true,
  });
  return Flag;
};