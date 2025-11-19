'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Package extends Model {
    static associate(models) {
      // Add association with PackageRequirement
      Package.hasMany(models.PackageRequirement, {
        foreignKey: 'package_id',
        as: 'requirements'
      });

      Package.hasMany(models.GuestApproval, {
        foreignKey: 'package_id',
        as: 'guestApprovals'
      });
    }
  }
  
  Package.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 255]
      }
    },
    package_code: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100]
      }
    },
    funder: {
      type: DataTypes.ENUM,
      values: ['NDIS', 'Non-NDIS'],
      allowNull: false,
      validate: {
        notEmpty: true,
        isIn: [['NDIS', 'Non-NDIS']]
      }
    },
    price: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      validate: {
        min: 0
      }
    },
    ndis_package_type: {
      type: DataTypes.ENUM,
      values: ['sta', 'holiday'],
      allowNull: true,
      validate: {
        isValidForFunder(value) {
          if (this.funder === 'NDIS' && !value) {
            throw new Error('NDIS package type is required for NDIS packages');
          }
          if (this.funder === 'Non-NDIS' && value) {
            throw new Error('NDIS package type should not be set for Non-NDIS packages');
          }
        }
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 2000]
      }
    },
    ndis_line_items: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      validate: {
        isValidLineItems(value) {
          if (this.funder === 'NDIS') {
            if (!value || !Array.isArray(value) || value.length === 0) {
              throw new Error('At least one line item is required for NDIS packages');
            }
            
            const requiredFields = ['line_item', 'price_per_night'];
            for (const item of value) {
              for (const field of requiredFields) {
                if (!item[field] && item[field] !== 0) {
                  throw new Error(`Line item missing required field: ${field}`);
                }
              }
              
              if (typeof item.price_per_night !== 'number' || item.price_per_night < 0) {
                throw new Error('Line item price must be a non-negative number');
              }
            }
          }
        }
      }
    },
    image_filename: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Package',
    tableName: 'packages',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['funder']
      },
      {
        fields: ['ndis_package_type']
      },
      {
        fields: ['package_code']
      },
      {
        unique: true,
        fields: ['package_code']
      }
    ]
  });
  
  return Package;
};