'use strict';

const { generateReferenceId } = require('./../utilities/bookings');
const { Booking } = require('./../models');

//For this migration, we are generating a reference ID for each existing booking that doesn't already have one. We are using the `generateReferenceId` function from the `utilities/bookings` file to generate a unique reference ID. We then update each booking with the new reference ID.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Fetch all bookings
    const bookings = await Booking.findAll();
    // Loop through each booking
    for (let booking of bookings) {
      // Generate a new reference ID
      if (booking.reference_id === null || booking.reference_id === '') {
        const referenceId = await generateReferenceId();
        console.log('--------------------Generated reference ID:', referenceId)
        // Update the booking with the new reference ID
        await Booking.update({ reference_id: referenceId }, { where: { id: booking.id } });
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    // In the 'down' function, we typically revert the changes made in the 'up' function.
    // However, in this case, it's not clear what the original state was, so we'll leave it empty.
  }
};