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

      // NEW: Add association to Package
      GuestFunding.belongsTo(models.Package, {
        foreignKey: 'package_id',
        as: 'package'
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
    // UPDATED: Replace package_approved (STRING) with package_id (INTEGER)
    package_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'packages',
        key: 'id'
      },
      validate: {
        isExistingPackage: async function(value) {
          if (value) {
            const { Package } = sequelize.models;
            const packageExists = await Package.findByPk(value);
            if (!packageExists) {
              throw new Error('Selected package does not exist');
            }
          }
        }
      }
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
    underscored: true,
    indexes: [
      {
        fields: ['guest_id']
      },
      {
        fields: ['package_id']
      },
      {
        fields: ['approval_from', 'approval_to']
      }
    ]
  });

  return GuestFunding;
};