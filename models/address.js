'use strict';
const {
  Model
} = require('sequelize');

const uppercaseFirst = str => `${str[0].toUpperCase()}${str.substr(1)}`;

module.exports = (sequelize, DataTypes) => {
  class Address extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    getAddressable(options) {
      if (!this.addressable_type) return Promise.resolve(null);
      const mixinMethodName = `get${uppercaseFirst(this.addressable_type)}`;
      return this[mixinMethodName](options);
    }
  }

  Address.init({
    addressable_id: DataTypes.INTEGER,
    addressable_type: DataTypes.STRING,
    address_line_1: DataTypes.STRING,
    address_line_2: DataTypes.STRING,
    city: DataTypes.STRING,
    state: DataTypes.STRING,
    zip_code: DataTypes.STRING,
    country: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Address',
    tableName: 'addresses',
    underscored: true
  });
  return Address;
};