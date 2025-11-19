'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Guest extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Has many FundingApprovals
      Guest.hasMany(models.FundingApproval, {
        foreignKey: 'guest_id',
        as: 'fundingApprovals'
      });
    }
  }
  Guest.init({
    uuid: {
      type: DataTypes.STRING,
      defaultValue: DataTypes.UUIDV4,
    },
    first_name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    email: DataTypes.STRING,
    phone_number: DataTypes.STRING,
    profile_filename: DataTypes.STRING,
    gender: DataTypes.STRING,
    dob: DataTypes.DATE,
    email_verified: DataTypes.INTEGER,
    password: DataTypes.STRING,
    flags: DataTypes.JSON,
    active: DataTypes.BOOLEAN,
    address_street1: DataTypes.STRING,
    address_street2: DataTypes.STRING,
    address_city: DataTypes.STRING,
    address_state_province: DataTypes.STRING,
    address_postal: DataTypes.STRING,
    address_country: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Guest',
    tableName: 'guests',
    underscored: true,
  });

  return Guest;
};

async () => await Guest.sync();