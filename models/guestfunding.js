'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class GuestFunding extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Define association here
      GuestFunding.belongsTo(models.Guest, {
        foreignKey: 'guest_id',
        as: 'guest'
      });
    }
  }
  
  GuestFunding.init({
    guest_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'guests',
        key: 'id'
      }
    },
    approval_number: {
      type: DataTypes.STRING,
      allowNull: true
    },
    nights_approved: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    package_approved: {
      type: DataTypes.STRING,
      defaultValue: 'iCare',
      allowNull: true
    },
    approval_from: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    approval_to: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    nights_used: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'GuestFunding',
    tableName: 'guest_funding',
    underscored: true
  });

  return GuestFunding;
};