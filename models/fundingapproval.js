'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class FundingApproval extends Model {
    static associate(models) {
      // Belongs to Guest
      FundingApproval.belongsTo(models.Guest, {
        foreignKey: 'guest_id',
        as: 'guest'
      });

      // Belongs to Package
      FundingApproval.belongsTo(models.Package, {
        foreignKey: 'package_id',
        as: 'package'
      });

      // Belongs to RoomType for additional room
      FundingApproval.belongsTo(models.RoomType, {
        foreignKey: 'additional_room_type_id',
        as: 'additionalRoomType'
      });
    }
  }
  
  FundingApproval.init({
    guest_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'guests',
        key: 'id'
      }
    },
    approval_name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    approval_number: {
      type: DataTypes.STRING,
      allowNull: true
    },
    funding_type: {
      type: DataTypes.ENUM('icare', 'ndis', 'private', 'dva', 'other'),
      defaultValue: 'icare',
      allowNull: false
    },
    nights_approved: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    nights_used: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0
      }
    },
    package_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'packages',
        key: 'id'
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
    additional_room_type_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'room_types',
        key: 'id'
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
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'expired'),
      defaultValue: 'active',
      allowNull: false
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'FundingApproval',
    tableName: 'funding_approvals',
    underscored: true,
    indexes: [
      { fields: ['guest_id'] },
      { fields: ['funding_type'] },
      { fields: ['status'] },
      { fields: ['approval_from', 'approval_to'] }
    ]
  });

  return FundingApproval;
};