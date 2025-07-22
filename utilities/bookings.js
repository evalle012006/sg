const { Booking } = require('./../models');

const generateReferenceId = async () => {
    const maxReferenceId = await Booking.findOne({
        order: [['reference_id', 'DESC']],
        attributes: ['reference_id'],
    });

    // Generate a new booking ID by incrementing the maximum by 1 and padding it with leading zeros
    const newReferenceId = (maxReferenceId ? parseInt(maxReferenceId.reference_id || '000000', 10) + 1 : 1).toString().padStart(6, '100000');

    // Check if the new booking ID already exists
    const existingBooking = await Booking.findOne({ where: { reference_id: newReferenceId } });

    if (existingBooking) {
        // If the new booking ID already exists, recursively call the function to generate a new ID
        return generateReferenceId(Booking);
    } else {
        // If the new booking ID is unique, return it
        return newReferenceId;
    }
}

module.exports = {
    generateReferenceId,
};