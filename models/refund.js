'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Refund extends Model {}

  Refund.init({
    uuid:                  { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    booking_id:            { type: DataTypes.INTEGER, allowNull: false },
    payment_link_id:       { type: DataTypes.INTEGER, allowNull: true },
    stripe_refund_id:      { type: DataTypes.STRING, allowNull: true },
    stripe_payment_intent: { type: DataTypes.STRING, allowNull: false },
    amount_cents:          { type: DataTypes.INTEGER, allowNull: false },
    currency:              { type: DataTypes.STRING(3), defaultValue: 'aud' },
    status:                { type: DataTypes.ENUM('pending', 'succeeded', 'failed'), defaultValue: 'pending' },
    reason:                { type: DataTypes.TEXT },
    initiated_by_user_id:  { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'Refund',
    tableName: 'refunds',
    underscored: true,
  });

  return Refund;
};