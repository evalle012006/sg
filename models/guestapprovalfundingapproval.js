'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class GuestApprovalFundingApproval extends Model {
    static associate(models) {
      GuestApprovalFundingApproval.belongsTo(models.GuestApproval, {
        foreignKey: 'guest_approval_id',
        as: 'guestApproval'
      });

      GuestApprovalFundingApproval.belongsTo(models.FundingApproval, {
        foreignKey: 'funding_approval_id',
        as: 'fundingApproval'
      });
    }
  }
  
  GuestApprovalFundingApproval.init({
    guest_approval_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'guest_approvals',
        key: 'id'
      }
    },
    funding_approval_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'funding_approvals',
        key: 'id'
      }
    },
    nights_allocated: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    additional_room_nights_allocated: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'GuestApprovalFundingApproval',
    tableName: 'guest_approval_funding_approvals',
    underscored: true
  });

  return GuestApprovalFundingApproval;
};