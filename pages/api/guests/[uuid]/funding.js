import { Guest, GuestFunding } from '../../../../models';

export default async function handler(req, res) {
  const { uuid } = req.query;
  
  // Find guest by uuid to get the id
  const guest = await Guest.findOne({ 
    where: { uuid },
    attributes: ['id', 'uuid'] 
  });
  
  if (!guest) {
    return res.status(404).json({ message: 'Guest not found' });
  }
  
  if (req.method === 'GET') {
    try {
      const funding = await GuestFunding.findOne({
        where: { guest_id: guest.id }
      });
      
      let response = {
        approval_number: '',
        nights_approved: '',
        package_approved: 'iCare',
        approval_from: '',
        approval_to: '',
        nights_used: 0
      };
      
      if (funding) {
        response = {
          approval_number: funding.approval_number || '',
          nights_approved: funding.nights_approved || '',
          package_approved: funding.package_approved || 'iCare',
          approval_from: funding.approval_from || '',
          approval_to: funding.approval_to || '',
          nights_used: funding.nights_used || 0
        };
      }
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Error fetching funding information:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'An error occurred while fetching funding information'
      });
    }
  }
  
  else if (req.method === 'POST') {
    try {
      const { approval_number, nights_approved, package_approved, approval_from, approval_to, nights_used } = req.body;
      
      // Check if funding record exists
      const existingFunding = await GuestFunding.findOne({
        where: { guest_id: guest.id }
      });
      
      const fundingData = {
        guest_id: guest.id,
        approval_number: approval_number || null,
        nights_approved: parseInt(nights_approved) || null,
        package_approved: package_approved || 'iCare',
        approval_from: approval_from || null,
        approval_to: approval_to || null,
        nights_used: parseInt(nights_used) || 0
      };
      
      if (existingFunding) {
        // Update existing record
        await existingFunding.update(fundingData);
      } else {
        // Create new record
        await GuestFunding.create(fundingData);
      }
      
      res.status(200).json({ 
        success: true,
        message: 'Funding information saved successfully' 
      });
    } catch (error) {
      console.error('Error saving funding information:', error);
      
      // Handle Sequelize validation errors
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: error.errors.map(e => e.message).join(', ')
        });
      }

      // Handle Sequelize database errors
      if (error.name === 'SequelizeDatabaseError') {
        return res.status(500).json({
          success: false,
          error: 'Database error',
          message: process.env.NODE_ENV === 'development' ? error.message : 'Database operation failed'
        });
      }
      
      res.status(500).json({ 
        success: false,
        error: 'Internal server error',
        message: 'An error occurred while saving funding information'
      });
    }
  }
  
  else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({ message: `Method ${req.method} not allowed` });
  }
}

// Helper function to update nights used - can be called from booking triggers
export const updateNightsUsed = async (guestId, nightsUsed) => {
  try {
    const funding = await GuestFunding.findOne({
      where: { guest_id: guestId }
    });
    
    if (funding) {
      await funding.update({ nights_used: nightsUsed });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error updating nights used:', error);
    throw error;
  }
};