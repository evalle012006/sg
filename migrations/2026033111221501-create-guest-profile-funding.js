'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('guest_funding_profiles', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            guest_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'guests', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            // Normalised funder type — one row per guest per funder family
            funder_type: {
                type: Sequelize.ENUM('icare', 'ndis'),
                allowNull: false
            },
            // JSON blob: { question_key: answer, ... } for all prefillable
            // Funding page questions belonging to this funder type.
            // Excludes ndis_only/prefill=0 eligibility questions (booking-specific).
            funding_data: {
                type: Sequelize.JSON,
                allowNull: false,
                defaultValue: {}
            },
            // The confirmed booking that last wrote this record
            source_booking_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'bookings', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            created_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updated_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
            }
        });

        // One record per guest per funder family
        await queryInterface.addIndex('guest_funding_profiles', ['guest_id', 'funder_type'], {
            unique: true,
            name: 'guest_funding_profiles_guest_funder_unique'
        });

        await queryInterface.addIndex('guest_funding_profiles', ['guest_id'], {
            name: 'guest_funding_profiles_guest_id'
        });
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('guest_funding_profiles');
    }
};