'use strict';

module.exports = {
  async up(queryInterface) {
    // First clean up any existing duplicates that would violate the new constraint
    // (keep the latest row per question_id + section_id, delete the rest)
    await queryInterface.sequelize.query(`
      DELETE qp1 FROM qa_pairs qp1
      INNER JOIN qa_pairs qp2
        ON qp1.question_id = qp2.question_id
        AND qp1.section_id = qp2.section_id
        AND qp1.id < qp2.id
      WHERE qp1.question_id IS NOT NULL;
    `);

    // Now add the correct unique constraint
    await queryInterface.addIndex('qa_pairs', {
      fields: ['question_id', 'section_id'],
      unique: true,
      name: 'qa_pairs_question_id_section_id_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('qa_pairs', 'qa_pairs_question_id_section_id_unique');
  },
};