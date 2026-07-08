'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StripeWebhookEvent extends Model {}

  StripeWebhookEvent.init({
    event_id:     { type: DataTypes.STRING, allowNull: false, unique: true },
    event_type:   { type: DataTypes.STRING, allowNull: false },
    processed_at: { type: DataTypes.DATE, allowNull: false },
  }, {
    sequelize,
    modelName: 'StripeWebhookEvent',
    tableName: 'stripe_webhook_events',
    underscored: true,
  });

  return StripeWebhookEvent;
};