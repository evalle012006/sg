'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class GuestFundingProfile extends Model {
        static associate(models) {
            GuestFundingProfile.belongsTo(models.Guest, {
                foreignKey: 'guest_id',
                as: 'guest'
            });
            GuestFundingProfile.belongsTo(models.Booking, {
                foreignKey: 'source_booking_id',
                as: 'sourceBooking'
            });
        }
    }

    GuestFundingProfile.init({
        guest_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        funder_type: {
            type: DataTypes.ENUM('icare', 'ndis'),
            allowNull: false
        },
        funding_data: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: {}
        },
        source_booking_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'GuestFundingProfile',
        tableName: 'guest_funding_profiles',
        underscored: true
    });

    return GuestFundingProfile;
};