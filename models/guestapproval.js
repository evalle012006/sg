'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class GuestApproval extends Model {
    static associate(models) {
      GuestApproval.belongsTo(models.Guest, {
        foreignKey: 'guest_id',
        as: 'guest'
      });

      GuestApproval.belongsTo(models.Package, {
        foreignKey: 'package_id',
        as: 'package'
      });

      GuestApproval.belongsTo(models.RoomType, {
        foreignKey: 'additional_room_approved',
        as: 'additionalRoomType'
      });

      GuestApproval.hasMany(models.BookingApprovalUsage, {
        foreignKey: 'guest_approval_id',
        as: 'usages'
      });

      GuestApproval.belongsToMany(models.FundingApproval, {
        through: models.GuestApprovalFundingApproval,
        foreignKey: 'guest_approval_id',
        otherKey: 'funding_approval_id',
        as: 'fundingApprovals'
      });

      GuestApproval.hasMany(models.GuestApprovalFundingApproval, {
        foreignKey: 'guest_approval_id',
        as: 'fundingAllocations'
      });
    }

    // Helper method to calculate remaining nights
    getRemainingNights() {
      return (this.nights_approved || 0) - (this.nights_used || 0);
    }

    // Helper method to calculate remaining additional room nights
    getRemainingAdditionalNights() {
      return (this.additional_room_nights_approved || 0) - (this.additional_room_nights_used || 0);
    }

    // Check if approval is still valid
    isValid() {
      if (this.status !== 'active') return false;
      
      const now = new Date();
      const fromDate = new Date(this.approval_from);
      const toDate = new Date(this.approval_to);
      
      return now >= fromDate && now <= toDate;
    }
  }
  
  GuestApproval.init({
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
      allowNull: true
    },
    approval_number: {
      type: DataTypes.STRING,
      allowNull: true
    },
    approval_type: {
      type: DataTypes.ENUM('icare', 'ndis', 'private', 'other'),
      defaultValue: 'icare',
      allowNull: false
    },
    nights_approved: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    nights_used: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
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
    additional_room_approved: {
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
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('active', 'expired', 'exhausted', 'cancelled'),
      defaultValue: 'active',
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'GuestApproval',
    tableName: 'guest_approvals',
    underscored: true,
    indexes: [
      { fields: ['guest_id'] },
      { fields: ['package_id'] },
      { fields: ['status'] },
      { fields: ['approval_from', 'approval_to'] }
    ]
  });

  return GuestApproval;
};