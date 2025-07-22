'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Template extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
  }

  Template.init({
    uuid: {
      type: DataTypes.UUIDV4,
      unique: true,
      defaultValue: DataTypes.UUIDV4
    }, 
    name: DataTypes.STRING,
    archived: DataTypes.BOOLEAN,
    archived_date: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'Template',
    tableName: 'templates',
    underscored: true,
  });

  return Template;
};
