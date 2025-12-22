'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Update approval_name to allow null
    await queryInterface.changeColumn('funding_approvals', 'approval_name', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // Update funding_type to allow null
    await queryInterface.changeColumn('funding_approvals', 'funding_type', {
      type: Sequelize.ENUM('icare', 'ndis', 'private', 'dva', 'other'),
      defaultValue: 'icare',
      allowNull: true
    });

    // Update nights_approved to allow null
    await queryInterface.changeColumn('funding_approvals', 'nights_approved', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    });

    // Update nights_used to allow null
    await queryInterface.changeColumn('funding_approvals', 'nights_used', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    });

    // Update status to allow null
    await queryInterface.changeColumn('funding_approvals', 'status', {
      type: Sequelize.ENUM('active', 'inactive', 'expired'),
      defaultValue: 'active',
      allowNull: true
    });

    // Update additional_room_nights_approved default to null
    await queryInterface.changeColumn('funding_approvals', 'additional_room_nights_approved', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    });

    // Update additional_room_nights_used default to null
    await queryInterface.changeColumn('funding_approvals', 'additional_room_nights_used', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert approval_name to not allow null
    await queryInterface.changeColumn('funding_approvals', 'approval_name', {
      type: Sequelize.STRING,
      allowNull: false
    });

    // Revert funding_type to not allow null
    await queryInterface.changeColumn('funding_approvals', 'funding_type', {
      type: Sequelize.ENUM('icare', 'ndis', 'private', 'dva', 'other'),
      defaultValue: 'icare',
      allowNull: false
    });

    // Revert nights_approved to not allow null
    await queryInterface.changeColumn('funding_approvals', 'nights_approved', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });

    // Revert nights_used to not allow null
    await queryInterface.changeColumn('funding_approvals', 'nights_used', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });

    // Revert status to not allow null
    await queryInterface.changeColumn('funding_approvals', 'status', {
      type: Sequelize.ENUM('active', 'inactive', 'expired'),
      defaultValue: 'active',
      allowNull: false
    });

    // Revert additional_room_nights_approved default to 0
    await queryInterface.changeColumn('funding_approvals', 'additional_room_nights_approved', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0
    });

    // Revert additional_room_nights_used default to 0
    await queryInterface.changeColumn('funding_approvals', 'additional_room_nights_used', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0
    });
  }
};