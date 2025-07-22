const { Guest, Booking } = require("../../../models");
import StorageService from "../../../services/storage/storage";

async function handler(req, res) {
  if (req.method === "GET") {
    const storage = new StorageService({ bucketType: 'restricted' });
    const guests = await Guest.findAll({ 
      order: [['first_name', 'ASC'], ['last_name', 'ASC']], 
      include: Booking 
    });

    // Use Promise.all to wait for all async operations
    const updatedGuests = await Promise.all(
      guests.map(async guest => {
        let temp = { ...guest.dataValues };
        temp.email_verified = guest.email_verified == null ? guest.password ? true : false : guest.email_verified;
        
        // Get profile URL and add it to the temp object
        if (guest.profile_filename) {
          temp.profileUrl = await storage.getSignedUrl('profile-photo' + '/' + guest.profile_filename);
        }
        
        if (temp.Bookings && Array.isArray(temp.Bookings)) {
          temp.Bookings = temp.Bookings.map(booking => {
            const bookingData = booking.dataValues || booking;
            const { signature, ...bookingWithoutSignature } = bookingData;
            return bookingWithoutSignature;
          });
        }
        
        delete temp.password;
        return temp;
      })
    );

    return res
      .status(201)
      .json({ message: "Successfully Fetched", users: updatedGuests });

  } else {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
}

export default handler;