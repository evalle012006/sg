'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('course_eois', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      guest_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'guests',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      guest_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      guest_email: {
        type: Sequelize.STRING,
        allowNull: false
      },
      guest_phone: {
        type: Sequelize.STRING,
        allowNull: true
      },
      funding_type: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'ndis, icare, other'
      },
      completing_for: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'myself',
        comment: 'myself or other'
      },
      has_sci: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: true
      },
      support_name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      support_phone: {
        type: Sequelize.STRING,
        allowNull: true
      },
      support_email: {
        type: Sequelize.STRING,
        allowNull: true
      },
      support_role: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'allied_health, support_coordinator, case_manager, other'
      },
      sci_levels: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Comma-separated list of SCI levels e.g. C5, T10, L2'
      },
      selected_courses: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'JSON array of course IDs'
      },
      course_date_preferences: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'JSON object with course ID keys and date array values'
      },
      comments: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'pending',
        comment: 'pending, contacted, converted, declined'
      },
      admin_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Internal notes from admin about this EOI'
      },
      submitted_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      contacted_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('course_eois', ['guest_id']);
    await queryInterface.addIndex('course_eois', ['guest_email']);
    await queryInterface.addIndex('course_eois', ['status']);
    await queryInterface.addIndex('course_eois', ['submitted_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('course_eois');
  }
};