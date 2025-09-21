import { Guest, GuestFunding, Package } from '../../../../models';

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
        where: { guest_id: guest.id },
        include: [
          {
            model: Package,
            as: 'package',
            attributes: ['id', 'name', 'package_code', 'funder']
          }
        ]
      });
      
      let response = {
        approval_number: '',
        nights_approved: '',
        package_id: null,
        package_approved: '', // Keep for backward compatibility
        approval_from: '',
        approval_to: '',
        nights_used: 0
      };
      
      if (funding) {
        // Format package display name for backward compatibility
        let packageDisplay = '';
        if (funding.package) {
          packageDisplay = funding.package.package_code 
            ? `${funding.package.name} (${funding.package.package_code})`
            : funding.package.name;
        }

        response = {
          approval_number: funding.approval_number || '',
          nights_approved: funding.nights_approved || '',
          package_id: funding.package_id || null,
          package_approved: packageDisplay, // For backward compatibility
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
      const { approval_number, nights_approved, package_id, package_approved, approval_from, approval_to, nights_used } = req.body;
      
      // Validate package_id if provided
      let validatedPackageId = null;
      if (package_id) {
        const packageExists = await Package.findByPk(package_id);
        if (!packageExists) {
          return res.status(400).json({ 
            message: 'Invalid package selected. Package does not exist.' 
          });
        }
        validatedPackageId = package_id;
      } else if (package_approved) {
        // Backward compatibility: try to find package by name/code
        const packageByName = await Package.findOne({
          where: {
            [Package.sequelize.Sequelize.Op.or]: [
              { name: package_approved },
              Package.sequelize.Sequelize.literal(`CONCAT(name, ' (', package_code, ')') = '${package_approved}'`)
            ]
          }
        });
        
        if (packageByName) {
          validatedPackageId = packageByName.id;
        }
      }
      
      // Check if funding record exists
      const existingFunding = await GuestFunding.findOne({
        where: { guest_id: guest.id }
      });
      
      const fundingData = {
        guest_id: guest.id,
        approval_number: approval_number || null,
        nights_approved: parseInt(nights_approved) || null,
        package_id: validatedPackageId,
        approval_from: approval_from || null,
        approval_to: approval_to || null,
        nights_used: parseInt(nights_used) || 0
      };
      
      if (existingFunding) {
        // Update existing record
        await GuestFunding.update(fundingData, {
          where: { guest_id: guest.id }
        });
      } else {
        // Create new record
        await GuestFunding.create(fundingData);
      }
      
      res.status(200).json({ 
        message: 'Funding information saved successfully!',
        data: fundingData
      });
      
    } catch (error) {
      console.error('Error saving funding information:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message || 'An error occurred while saving funding information'
      });
    }
  }
  
  else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({ message: 'Method not allowed' });
  }
}