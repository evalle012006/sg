'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Package extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
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
      allowNull: true, // Can be null for NDIS packages
      validate: {
        min: 0
      }
    },
    ndis_package_type: {
      type: DataTypes.ENUM,
      values: ['sta', 'holiday'],
      allowNull: true, // Only required for NDIS packages
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
            
            // Validate each line item
            value.forEach((item, index) => {
              if (!item.sta_package || typeof item.sta_package !== 'string' || item.sta_package.trim() === '') {
                throw new Error(`STA Package is required for line item ${index + 1}`);
              }
              if (!item.line_item || typeof item.line_item !== 'string' || item.line_item.trim() === '') {
                throw new Error(`Line Item is required for line item ${index + 1}`);
              }
              if (typeof item.price_per_night !== 'number' || item.price_per_night < 0) {
                throw new Error(`Valid price per night is required for line item ${index + 1}`);
              }
            });
          } else if (this.funder === 'Non-NDIS' && value && value.length > 0) {
            throw new Error('Line items should not be set for Non-NDIS packages');
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
    underscored: true,
    validate: {
      // Model-level validation to ensure data consistency
      validatePackageData() {
        if (this.funder === 'NDIS') {
          // For NDIS packages, price should be null and ndis_package_type should be set
          if (this.price !== null) {
            throw new Error('Price should not be set for NDIS packages');
          }
          if (!this.ndis_package_type) {
            throw new Error('NDIS package type is required for NDIS packages');
          }
          if (!this.ndis_line_items || this.ndis_line_items.length === 0) {
            throw new Error('At least one line item is required for NDIS packages');
          }
        } else if (this.funder === 'Non-NDIS') {
          // For Non-NDIS packages, price should be set and NDIS fields should be null
          if (this.price === null || this.price === undefined) {
            throw new Error('Price is required for Non-NDIS packages');
          }
          if (this.price < 0) {
            throw new Error('Price must be a positive number');
          }
          if (this.ndis_package_type !== null) {
            throw new Error('NDIS package type should not be set for Non-NDIS packages');
          }
          if (this.ndis_line_items && this.ndis_line_items.length > 0) {
            throw new Error('Line items should not be set for Non-NDIS packages');
          }
        }
      }
    },
    hooks: {
      beforeCreate: async (packageInstance, options) => {
        // Clean up data based on funder type
        if (packageInstance.funder === 'NDIS') {
          packageInstance.price = null;
        } else if (packageInstance.funder === 'Non-NDIS') {
          packageInstance.ndis_package_type = null;
          packageInstance.ndis_line_items = [];
        }
      },
      beforeUpdate: async (packageInstance, options) => {
        // Clean up data based on funder type
        if (packageInstance.funder === 'NDIS') {
          packageInstance.price = null;
        } else if (packageInstance.funder === 'Non-NDIS') {
          packageInstance.ndis_package_type = null;
          packageInstance.ndis_line_items = [];
        }
      }
    }
  });

  return Package;
};

// Auto-sync the model (uncomment if needed for development)
// async () => await Package.sync();