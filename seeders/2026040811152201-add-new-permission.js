'use strict';

// New permission IDs (continuing from last existing id: 33)
const NEW_PERMISSIONS = [
  { id: 34, action: 'Read',        subject: 'Report' },
  { id: 35, action: 'Create/Edit', subject: 'Course' },
  { id: 36, action: 'Create/Edit', subject: 'Approval' },
  { id: 37, action: 'Create/Edit', subject: 'Promotion' },
  { id: 38, action: 'Create/Edit', subject: 'GuestFlag' },
];

// Read Only role id = 4
const READ_ONLY_ROLE_ID = 4;

// Only GuestFlag is granted to Read Only
const READ_ONLY_GRANTS = [38];

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // 1. Insert new permissions
    await queryInterface.bulkInsert('permissions', NEW_PERMISSIONS.map(p => ({
      id:         p.id,
      action:     p.action,
      subject:    p.subject,
      fields:     '',
      conditions: '',
      inverted:   null,
      reason:     '',
      created_at:  now,
      updated_at:  now,
    })));

    // 2. Grant Create/Edit GuestFlag to the Read Only role
    await queryInterface.bulkInsert('role_has_permissions', READ_ONLY_GRANTS.map(permId => ({
      role_id:       READ_ONLY_ROLE_ID,
      permission_id: permId,
      created_at:    now,
      updated_at:    now,
      created_at:     now,
      updated_at:     now,
    })));
  },

  async down(queryInterface, Sequelize) {
    // Remove the role_has_permissions grant first (FK constraint)
    await queryInterface.bulkDelete('role_has_permissions', {
      role_id:       READ_ONLY_ROLE_ID,
      permission_id: READ_ONLY_GRANTS,
    });

    // Remove the new permissions
    await queryInterface.bulkDelete('permissions', {
      id: NEW_PERMISSIONS.map(p => p.id),
    });
  },
};