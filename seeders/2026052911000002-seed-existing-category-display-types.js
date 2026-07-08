'use strict';

/**
 * Seed migration: populate display_type, is_required, custom_label on existing
 * equipment_categories rows so their current behaviour is exactly preserved.
 *
 * Source of truth for these values: determineCategoryTypes(), isRequiredCategory(),
 * getBinaryQuestionLabel(), getConfirmationQuestionLabel() in equipment.js.
 *
 * Run this AFTER add-display-type-to-equipment-categories.js.
 *
 * Safe to re-run — uses UPDATE WHERE to avoid double-applying.
 */

const CATEGORY_CONFIG = [
  // name (snake_case DB value)  display_type           is_required  custom_label
  { name: 'mattress_options',    display_type: 'single_select',      is_required: true,  custom_label: null },
  { name: 'sling',               display_type: 'single_select',      is_required: false, custom_label: null },
  // sling is conditionally required (only when ceiling_hoist=yes) — is_required stays
  // false here; the frontend handles the conditional logic separately.

  { name: 'shower_commodes',     display_type: 'confirmation_single', is_required: true, custom_label: 'Would you like to book a shower commode?' },
  { name: 'adaptive_bathroom_options', display_type: 'multi_select', is_required: false, custom_label: null },
  { name: 'transfer_aids',       display_type: 'multi_select',       is_required: false, custom_label: null },
  { name: 'miscellaneous',       display_type: 'multi_select',       is_required: false, custom_label: null },
  { name: 'infant_care',         display_type: 'special',            is_required: false, custom_label: null },
  // binary categories (single-item yes/no)
  { name: 'ceiling_hoist',       display_type: 'binary',             is_required: true,  custom_label: 'Will you be using our ceiling hoist?' },
  { name: 'slide_transfer_boards', display_type: 'binary',           is_required: true,  custom_label: 'Would you like to use a slide transfer board?' },
  { name: 'wheelchair_chargers', display_type: 'binary',             is_required: true,  custom_label: 'Do you require a wheelchair charger for this stay?' },
  { name: 'remote_room_openers', display_type: 'binary',             is_required: true,  custom_label: 'Do you need to be set up with a remote door opener (activated by a jelly bean switch) to access your room?' },
  { name: 'bed_controllers',     display_type: 'binary',             is_required: true,  custom_label: 'Do you need to be set up with an accessible bed controller (activated by a jelly bean switch) to operate your adjustable bed?' },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    for (const config of CATEGORY_CONFIG) {
      await queryInterface.sequelize.query(`
        UPDATE equipment_categories
        SET
          display_type        = :display_type,
          is_required         = :is_required,
          custom_label        = :custom_label,
          requires_confirmation = :requires_confirmation,
          updated_at          = NOW()
        WHERE name = :name
      `, {
        replacements: {
          name:                  config.name,
          display_type:          config.display_type,
          is_required:           config.is_required ? 1 : 0,
          custom_label:          config.custom_label ?? null,
          requires_confirmation: ['confirmation_single', 'confirmation_multi'].includes(config.display_type) ? 1 : 0
        }
      });
      console.log(`✅ Seeded display_type for category: ${config.name}`);
    }
  },

  async down(queryInterface) {
    // Revert all seeded categories back to the default (binary, not required, no label)
    const names = CATEGORY_CONFIG.map(c => `'${c.name}'`).join(', ');
    await queryInterface.sequelize.query(`
      UPDATE equipment_categories
      SET
        display_type          = 'binary',
        is_required           = 0,
        custom_label          = NULL,
        requires_confirmation = 0,
        updated_at            = NOW()
      WHERE name IN (${names})
    `);
    console.log('✅ Reverted display_type seed for all known categories');
  }
};