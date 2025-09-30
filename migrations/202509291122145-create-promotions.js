'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('promotions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      availability: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Display text for availability period'
      },
      terms: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Terms and conditions for the promotion'
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      image_filename: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Filename of promotion image in storage'
      },
      status: {
        type: Sequelize.ENUM('draft', 'published', 'archived'),
        defaultValue: 'draft',
        allowNull: false
      },
      order: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Display order'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Add index for status
    await queryInterface.addIndex('promotions', ['status'], {
      name: 'idx_promotions_status'
    });

    // Add index for dates
    await queryInterface.addIndex('promotions', ['start_date', 'end_date'], {
      name: 'idx_promotions_dates'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('promotions');
  }
};