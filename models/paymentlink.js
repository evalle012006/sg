'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PaymentLink extends Model {
    static associate(models) {}

    isValid() {
      return (
        this.status === 'pending' &&
        new Date() < new Date(this.expires_at)
      );
    }
  }

  PaymentLink.init({
    uuid:                  { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    booking_id:            { type: DataTypes.INTEGER, allowNull: false },
    stripe_session_id:     { type: DataTypes.STRING },
    stripe_payment_intent: { type: DataTypes.STRING },
    amount_cents:          { type: DataTypes.INTEGER, allowNull: false },
    currency:              { type: DataTypes.STRING(3), defaultValue: 'aud' },
    status:                { type: DataTypes.ENUM('pending', 'paid', 'expired', 'cancelled', 'failed', 'refunded', 'partially_refunded','deadline_cancelled'), defaultValue: 'pending' },
    expires_at:            { type: DataTypes.DATE, allowNull: false },
    paid_at:               { type: DataTypes.DATE },
    sent_at:               { type: DataTypes.DATE },
    reminders_sent:        { type: DataTypes.JSON, allowNull: true, defaultValue: []},
  }, {
    sequelize,
    modelName: 'PaymentLink',
    tableName: 'payment_links',
    underscored: true,
  });

  return PaymentLink;
};