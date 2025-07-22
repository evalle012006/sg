'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.hasMany(models.AccessToken, {
        foreignKey: 'tokenable_id',
        constraints: false,
        scope: {
          tokenable_type: 'user'
        }
      });
    }
  }
  User.init({
    uuid: {
      type: DataTypes.STRING,
      defaultValue: DataTypes.UUIDV4,
    },
    first_name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    email: DataTypes.STRING,
    phone_number: DataTypes.STRING,
    email_verified: DataTypes.INTEGER,
    password: DataTypes.STRING,
    profile_filename: DataTypes.STRING,
    root: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    underscored: true,
  });
  return User;
};