'use strict';

const { faker } = require('@faker-js/faker');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('room_types', [{
      name: 'Standard Studio Room',
      type: 'studio',
      ergonomic_king_beds: 1,
      king_single_beds: 0,
      queen_sofa_beds: 1,
      bedrooms: 1,
      bathrooms: 1,
      ocean_view: 0,
      max_guests: 3,
      price_per_night: 300,
      image_filename: "standard-studio-room.jpg",
      created_at: faker.datatype.datetime(),
      updated_at: faker.datatype.datetime(),
    }, {
      name: 'Deluxe Studio Room',
      type: 'studio',
      ergonomic_king_beds: 1,
      king_single_beds: 1,
      queen_sofa_beds: 1,
      bedrooms: 1,
      bathrooms: 1,
      ocean_view: 0,
      max_guests: 4,
      price_per_night: 400,
      image_filename: "deluxe-studio-room.jpg",
      created_at: faker.datatype.datetime(),
      updated_at: faker.datatype.datetime(),
    }, {
      name: 'Ocean View Room',
      type: 'ocean_view',
      ergonomic_king_beds: 1,
      king_single_beds: 1,
      queen_sofa_beds: 1,
      bedrooms: 1,
      bathrooms: 1,
      ocean_view: 1,
      max_guests: 4,
      price_per_night: 150,
      image_filename: "ocean-view-room.jpg",
      created_at: faker.datatype.datetime(),
      updated_at: faker.datatype.datetime(),
    }, {
      name: '2 Room Family Suite',
      type: 'suite',
      ergonomic_king_beds: 2,
      king_single_beds: 2,
      queen_sofa_beds: 1,
      bedrooms: 2,
      bathrooms: 1,
      ocean_view: 0,
      max_guests: 6,
      price_per_night: 300,
      image_filename: "2-room-family-suite.jpeg",
      created_at: faker.datatype.datetime(),
      updated_at: faker.datatype.datetime(),
    }, {
      name: '2 Room Deluxe Family Suite',
      type: 'suite',
      ergonomic_king_beds: 2,
      king_single_beds: 2,
      queen_sofa_beds: 2,
      bedrooms: 2,
      bathrooms: 2,
      ocean_view: 0,
      max_guests: 8,
      price_per_night: 350,
      image_filename: "2-room-deluxe-family-suite.jpeg",
      created_at: faker.datatype.datetime(),
      updated_at: faker.datatype.datetime(),
    }, {
      name: 'Ocean View Family Suite',
      type: 'ocean_view_suite',
      ergonomic_king_beds: 2,
      king_single_beds: 1,
      queen_sofa_beds: 2,
      bedrooms: 2,
      bathrooms: 2,
      ocean_view: 1,
      max_guests: 7,
      price_per_night: 500,
      image_filename: "ocean-view-family-suite.jpeg",
      created_at: faker.datatype.datetime(),
      updated_at: faker.datatype.datetime(),
    }], {});
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
