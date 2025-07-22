'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class NotificationLibrary extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  NotificationLibrary.init({
    name: DataTypes.STRING,
    type: DataTypes.STRING,
    alert_type: DataTypes.STRING,
    notification_to: DataTypes.STRING,
    notification: DataTypes.STRING,
    date_factor: DataTypes.INTEGER,
    enabled: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'NotificationLibrary',
    tableName: 'notifications_library',
    underscored: true,
  });
  return NotificationLibrary;
};