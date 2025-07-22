'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Log extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Log.init({
    data: DataTypes.JSON,
    type: DataTypes.STRING,
    loggable_id: DataTypes.INTEGER,
    loggable_type: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Log',
    tableName: 'logs',
    underscored: true,
  });
  return Log;
};