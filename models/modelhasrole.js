'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ModelHasRole extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ModelHasRole.init({
    model_id: DataTypes.INTEGER,
    model_type: DataTypes.STRING,
    role_id: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'ModelHasRole',
    tableName: 'model_has_roles',
    underscored: true
  });

  return ModelHasRole;
};