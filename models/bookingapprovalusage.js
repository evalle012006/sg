'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class BookingApprovalUsage extends Model {
    static associate(models) {
      BookingApprovalUsage.belongsTo(models.Booking, {
        foreignKey: 'booking_id',
        as: 'booking'
      });

      BookingApprovalUsage.belongsTo(models.GuestApproval, {
        foreignKey: 'guest_approval_id',
        as: 'approval'
      });
    }
  }
  
  BookingApprovalUsage.init({
    booking_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'bookings',
        key: 'id'
      }
    },
    guest_approval_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'guest_approvals',
        key: 'id'
      }
    },
    room_type: {
      type: DataTypes.ENUM('primary', 'additional'),
      defaultValue: 'primary',
      allowNull: false
    },
    nights_consumed: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'late_cancelled'),
      defaultValue: 'pending',
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'BookingApprovalUsage',
    tableName: 'booking_approval_usages',
    underscored: true,
    indexes: [
      { fields: ['booking_id'] },
      { fields: ['guest_approval_id'] },
      { fields: ['status'] }
    ]
  });

  return BookingApprovalUsage;
};