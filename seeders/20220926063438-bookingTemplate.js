'use strict';

const { faker } = require('@faker-js/faker')
const TemplateData = require('./default-booking-template.json');

module.exports = {
  async up(queryInterface, Sequelize) {

    const bookingTemplate = await queryInterface.bulkInsert('templates', [{
      id: TemplateData.id,
      uuid: faker.datatype.uuid(),
      name: TemplateData.name,
      created_at: new Date(),
      updated_at: new Date()
    }]);

    for (let i = 0; i < TemplateData.pages.length; i++) {
      await queryInterface.bulkInsert('pages', [{
        id: TemplateData.pages[i].id,
        title: TemplateData.pages[i].title,
        template_id: TemplateData.id,
        created_at: new Date(),
        updated_at: new Date()
      }]);

      for (let j = 0; j < TemplateData.pages[i].sections.length; j++) {
        await queryInterface.bulkInsert('sections', [{
          id: TemplateData.pages[i].sections[j].id,
          label: TemplateData.pages[i].sections[j].label,
          order: TemplateData.pages[i].sections[j].order,
          type: TemplateData.pages[i].sections[j].type,
          model_type: 'page',
          model_id: TemplateData.pages[i].id,
          created_at: new Date(),
          updated_at: new Date()
        }]);

        for (let k = 0; k < TemplateData.pages[i].sections[j].questions.length; k++) {
          await queryInterface.bulkInsert('questions', [{
            ...TemplateData.pages[i].sections[j].questions[k],
            options: JSON.stringify(TemplateData.pages[i].sections[j].questions[k].options),
            details: JSON.stringify(TemplateData.pages[i].sections[j].questions[k].details),
            section_id: TemplateData.pages[i].sections[j].id,
            created_at: new Date(),
            updated_at: new Date()
          }]);
        }
      }
    }

    TemplateData.pages.forEach(async (page) => {
      page.dependencies.forEach(async (dependency) => {
        await queryInterface.bulkInsert('question_dependencies', [{ ...dependency, created_at: new Date(), updated_at: new Date() }]);
      });
    });

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
