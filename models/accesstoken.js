'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class AccessToken extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */

    getTokenable(options) {
      if (!this.tokenable_type) return Promise.resolve(null);
      const mixinMethodName = `get${uppercaseFirst(this.tokenable_type)}`;
      return this[mixinMethodName](options);
    }

    static associate(models) {
      // define association here
    }
  }
  AccessToken.init({
    token: DataTypes.STRING,
    tokenable_id: DataTypes.STRING,
    tokenable_type: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'AccessToken',
    tableName: 'access_tokens',
    underscored: true
  });
  return AccessToken;
};