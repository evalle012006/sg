'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('package_requirements', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      package_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'packages',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      // Care requirements
      care_hours_min: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment: 'Minimum care hours required (null = no minimum)'
      },
      care_hours_max: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment: 'Maximum care hours allowed (null = no maximum)'
      },
      requires_no_care: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Package specifically requires no care'
      },
      // Course requirements
      requires_course: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: null,
        comment: 'true = requires course, false = no course allowed, null = optional'
      },
      compatible_with_course: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether package can be combined with courses'
      },
      // Additional filters
      sta_requirements: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: null,
        comment: 'NDIS STA specific requirements'
      },
      // Priority and visibility
      display_priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Display priority (higher numbers shown first)'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether this requirement rule is active'
      },
      // Metadata
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'ID of user who created this requirement'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Internal notes about this requirement rule'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add indexes
    await queryInterface.addIndex('package_requirements', ['package_id']);
    await queryInterface.addIndex('package_requirements', ['is_active']);
    await queryInterface.addIndex('package_requirements', ['display_priority']);
    await queryInterface.addIndex('package_requirements', ['care_hours_min', 'care_hours_max']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('package_requirements');
  }
};