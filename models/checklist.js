'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Checklist extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
  }
  Checklist.init({
    name: DataTypes.STRING,
    booking_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'bookings', key: 'id'
      }
    }
  }, {
    sequelize,
    modelName: 'Checklist',
    tableName: 'checklists',
    underscored: true,
  });
  return Checklist;
};
