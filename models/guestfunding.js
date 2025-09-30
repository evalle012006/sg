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

      // Association to Package (iCare package)
      GuestFunding.belongsTo(models.Package, {
        foreignKey: 'package_id',
        as: 'package'
      });

      // NEW: Association to RoomType (additional room type)
      GuestFunding.belongsTo(models.RoomType, {
        foreignKey: 'additional_room_approved',
        as: 'additionalRoomType'
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
    },
    additional_room_approved: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'room_types',
        key: 'id'
      },
      validate: {
        isExistingRoomType: async function(value) {
          if (value) {
            const { RoomType } = sequelize.models;
            const roomTypeExists = await RoomType.findByPk(value);
            if (!roomTypeExists) {
              throw new Error('Selected room type does not exist');
            }
          }
        }
      }
    },
    additional_room_nights_approved: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: true
    },
    additional_room_nights_used: {
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
        fields: ['additional_room_approved']
      },
      {
        fields: ['approval_from', 'approval_to']
      }
    ]
  });

  return GuestFunding;
};