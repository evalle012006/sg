// populate-name-columns.js
const { Booking } = require('../models');

async function populateNameColumns() {
  console.log('Starting to populate status_name and eligibility_name columns...');
  
  try {
    // Get all bookings
    const bookings = await Booking.findAll();
    let processedCount = 0;
    
    for (const booking of bookings) {
      let statusName = null;
      let eligibilityName = null;
      
      // Extract status_name
      if (booking.status) {
        // Handle different data formats without modifying original
        try {
          // If it's already an object
          if (typeof booking.status === 'object' && booking.status !== null) {
            statusName = booking.status.name || null;
          } 
          // If it's a JSON string
          else if (typeof booking.status === 'string') {
            try {
              const statusObj = JSON.parse(booking.status);
              statusName = statusObj.name || null;
            } catch (e) {
              // Not JSON, use as is if it's not [object Object]
              statusName = booking.status === '[object Object]' ? null : booking.status;
            }
          }
        } catch (e) {
          console.error(`Error extracting status_name for booking ${booking.id}:`, e);
        }
      }
      
      // Extract eligibility_name
      if (booking.eligibility) {
        // Handle different data formats without modifying original
        try {
          // If it's already an object
          if (typeof booking.eligibility === 'object' && booking.eligibility !== null) {
            eligibilityName = booking.eligibility.name || null;
          } 
          // If it's a JSON string
          else if (typeof booking.eligibility === 'string') {
            try {
              const eligibilityObj = JSON.parse(booking.eligibility);
              eligibilityName = eligibilityObj.name || null;
            } catch (e) {
              // Not JSON, use as is if it's not [object Object]
              eligibilityName = booking.eligibility === '[object Object]' ? null : booking.eligibility;
            }
          }
        } catch (e) {
          console.error(`Error extracting eligibility_name for booking ${booking.id}:`, e);
        }
      }
      
      // Only update the new columns, don't touch the original data
      if (statusName !== null || eligibilityName !== null) {
        await booking.update({
          status_name: statusName,
          eligibility_name: eligibilityName
        }, {
          // Only update these specific fields
          fields: ['status_name', 'eligibility_name']
        });
        
        processedCount++;
        
        if (processedCount % 100 === 0) {
          console.log(`Processed ${processedCount} bookings...`);
        }
      }
    }
    
    console.log(`Completed processing ${processedCount} bookings.`);
  } catch (error) {
    console.error('Error populating name columns:', error);
  }
}

// Run the function
populateNameColumns()
  .then(() => {
    console.log('Name columns population completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });