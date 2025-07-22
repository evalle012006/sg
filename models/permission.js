'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Permission extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
  }
  Permission.init({
    action: DataTypes.STRING,
    subject: DataTypes.STRING,
    fields: DataTypes.STRING,
    conditions: DataTypes.STRING,
    inverted: DataTypes.BOOLEAN,
    reason: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Permission',
    tableName: 'permissions',
    underscored: true
  });

  return Permission;
};

async () => await Permission.sync()