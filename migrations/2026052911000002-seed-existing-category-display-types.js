'use strict';

/**
 * Migration: add display_type, is_required, custom_label, requires_confirmation
 * to equipment_categories table.
 *
 * display_type replaces the hardcoded categoryName switch in determineCategoryTypes().
 * is_required replaces the hardcoded arrays in isRequiredCategory().
 * custom_label replaces the hardcoded label maps in getBinaryQuestionLabel() etc.
 * requires_confirmation replaces the confirmation_single / confirmation_multi prefix logic.
 *
 * Existing rows are seeded in a separate seed migration
 * (add-display-type-seed-existing-categories.js) so this file stays
 * schema-only and is safe to roll back independently.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('equipment_categories', 'display_type', {
      type: Sequelize.ENUM(
        'binary',             // Yes / No radio — single equipment item per category
        'single_select',      // Pick one from a list (e.g. mattress, sling)
        'multi_select',       // Pick many from a list (e.g. transfer aids)
        'confirmation_single',// Yes/No gate then pick one (e.g. shower commode)
        'confirmation_multi', // Yes/No gate then pick many
        'special'             // Custom renderer (e.g. infant_care quantity spinner)
      ),
      allowNull: false,
      defaultValue: 'binary',
      comment: 'Controls how this category renders in the booking equipment form'
    });

    await queryInterface.addColumn('equipment_categories', 'is_required', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether the guest must make a selection in this category'
    });

    await queryInterface.addColumn('equipment_categories', 'custom_label', {
      type: Sequelize.STRING(500),
      allowNull: true,
      defaultValue: null,
      comment: 'Overrides the auto-generated question label shown to the guest. NULL = use default.'
    });

    await queryInterface.addColumn('equipment_categories', 'requires_confirmation', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether this category shows a Yes/No confirmation step before showing equipment items. Redundant when display_type is confirmation_single or confirmation_multi but kept for clarity.'
    });

    console.log('✅ Added display_type, is_required, custom_label, requires_confirmation to equipment_categories');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('equipment_categories', 'requires_confirmation');
    await queryInterface.removeColumn('equipment_categories', 'custom_label');
    await queryInterface.removeColumn('equipment_categories', 'is_required');
    await queryInterface.removeColumn('equipment_categories', 'display_type');

    // Drop the ENUM type (MySQL manages ENUM inline — no explicit type drop needed.
    // PostgreSQL would need: await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_equipment_categories_display_type"');)

    console.log('✅ Removed display_type, is_required, custom_label, requires_confirmation from equipment_categories');
  }
};