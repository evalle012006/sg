'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // First insert the new Equipments page
    await queryInterface.bulkInsert('pages', [
      {
        title: 'Equipment',
        template_id: 26,
        created_at: new Date(),
        updated_at: new Date(),
        order: 7,
      }
    ]);

    // Get the newly inserted page's ID
    const page = await queryInterface.sequelize.query(
      `SELECT id FROM pages WHERE title = 'Equipment'`
    );
    const pageId = page[0][0].id;

    // Update the order for existing pages with specific IDs
    await Promise.all([
      queryInterface.bulkUpdate('pages',
        { order: 8 },
        { id: 222 }
      ),
      queryInterface.bulkUpdate('pages',
        { order: 9 },
        { id: 223 }
      ),
      queryInterface.bulkUpdate('pages',
        { order: 10 },
        { id: 224 }
      )
    ]);

    // Get the section ID and update it to link with the new Equipments page
    const equipmentSection = await queryInterface.sequelize.query(
      `SELECT s.id 
       FROM sections AS s 
       JOIN questions AS q ON q.section_id = s.id 
       WHERE q.type = 'equipment' 
       AND s.model_type = 'page' 
       AND s.model_id = 221`
    );
    
    if (equipmentSection[0] && equipmentSection[0][0]) {
      const sectionId = equipmentSection[0][0].id;
      
      // Update the section to point to the new Equipments page
      await queryInterface.bulkUpdate('sections',
        { model_id: pageId, order: 1 },
        { id: sectionId }
      );
    }

    const queenFoldOutSection = await queryInterface.sequelize.query(
      `SELECT s.id 
       FROM sections AS s 
       JOIN questions AS q ON q.section_id = s.id 
       WHERE q.question = 'Do you require the Queen Fold Out Sofa Bed to be made up for extra guests?' 
       AND s.model_type = 'page' 
       AND s.model_id = 221`
    );
    
    if (queenFoldOutSection[0] && queenFoldOutSection[0][0]) {
      const sectionId = queenFoldOutSection[0][0].id;
      
      await queryInterface.bulkUpdate('sections',
        { model_id: pageId, order: 2 },
        { id: sectionId }
      );
    }


  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  }
};
