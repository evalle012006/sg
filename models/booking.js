'use strict';
const {
  Model
} = require('sequelize');
const { BOOKING_TYPES } = require('../components/constants');

module.exports = (sequelize, DataTypes) => {
  class Booking extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */

  }
  Booking.init({
    uuid: {
      type: DataTypes.UUIDV4,
      unique: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: DataTypes.STRING,
    guest_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'guests', key: 'id',
      }
    },
    type: {
      type: DataTypes.STRING,
      defaultValue: BOOKING_TYPES.FIRST_TIME_GUEST
    },
    alternate_contact_name: DataTypes.STRING,
    alternate_contact_number: DataTypes.STRING,
    type_of_spinal_injury: DataTypes.STRING,
    preferred_arrival_date: DataTypes.DATE,
    preferred_departure_date: DataTypes.DATE,
    late_arrival: DataTypes.BOOLEAN,
    eligibility: { type: DataTypes.STRING, defaultValue: JSON.stringify({ name: 'pending_approval', label: 'Pending Approval', color: 'yellow' }) },
    status: { type: DataTypes.STRING, defaultValue: JSON.stringify({ name: 'enquiry', label: 'Enquiry', color: 'gray' }) },
    metainfo: { type: DataTypes.STRING},
    complete: DataTypes.BOOLEAN,
    status_logs: DataTypes.TEXT,
    notes: DataTypes.TEXT,
    checklist_notes: DataTypes.TEXT,
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
    deleted_at: DataTypes.DATE, 
    reference_id: DataTypes.STRING,
    label: DataTypes.JSON,
    signature: DataTypes.JSON,
    verbal_consent: DataTypes.JSON,
    status_name: DataTypes.STRING,
    eligibility_name: DataTypes.STRING,
    cancellation_type: {
      type: DataTypes.ENUM('no_charge', 'full_charge'),
      allowNull: true,
      defaultValue: null,
      comment: 'Type of cancellation charge: no_charge (nights returned) or full_charge (penalty applied)'
    },
  }, {
    sequelize,
    modelName: 'Booking',
    tableName: 'bookings',
    underscored: true,
  });

  return Booking;
};