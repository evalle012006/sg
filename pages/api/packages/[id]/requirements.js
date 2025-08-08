import { Package, PackageRequirement } from "../../../../models";

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    // Get existing requirements for a package
    try {
      const requirement = await PackageRequirement.findOne({
        where: { package_id: id }
      });

      if (requirement) {
        return res.status(200).json({
          success: true,
          requirement: requirement
        });
      } else {
        // No requirements found - return empty state so form can open
        return res.status(200).json({
          success: true,
          requirement: null,
          message: 'No requirements found for this package'
        });
      }
    } catch (error) {
      console.error('Error fetching requirements:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch requirements',
        message: error.message
      });
    }
  }

  if (req.method === 'POST') {
    // Create new requirements for a package
    try {
      const requirementData = req.body;

      // Validate the package exists first
      const packageExists = await Package.findByPk(id);
      
      if (!packageExists) {
        return res.status(404).json({
          success: false,
          error: 'Package not found'
        });
      }

      // Check if requirements already exist
      const existingRequirement = await PackageRequirement.findOne({
        where: { package_id: id }
      });

      if (existingRequirement) {
        return res.status(409).json({
          success: false,
          error: 'Requirements already exist for this package. Use PUT to update.'
        });
      }

      // Create new requirement
      const newRequirement = await PackageRequirement.create({
        package_id: parseInt(id),
        ...requirementData
      });

      return res.status(201).json({
        success: true,
        message: 'Requirements created successfully',
        requirement: newRequirement
      });
    } catch (error) {
      console.error('Error creating requirements:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create requirements',
        message: error.message
      });
    }
  }

  if (req.method === 'PUT') {
    // Update existing requirements for a package
    try {
      const requirementData = req.body;

      // Find existing requirement
      const existingRequirement = await PackageRequirement.findOne({
        where: { package_id: id }
      });

      if (existingRequirement) {
        // Update existing requirement
        await existingRequirement.update(requirementData);
        
        return res.status(200).json({
          success: true,
          message: 'Requirements updated successfully',
          requirement: existingRequirement
        });
      } else {
        // Create new requirement if it doesn't exist
        const newRequirement = await PackageRequirement.create({
          package_id: parseInt(id),
          ...requirementData
        });

        return res.status(201).json({
          success: true,
          message: 'Requirements created successfully',
          requirement: newRequirement
        });
      }
    } catch (error) {
      console.error('Error updating requirements:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update requirements',
        message: error.message
      });
    }
  }

  if (req.method === 'DELETE') {
    // Delete requirements for a package
    try {
      const deletedCount = await PackageRequirement.destroy({
        where: { package_id: id }
      });

      if (deletedCount > 0) {
        return res.status(200).json({
          success: true,
          message: 'Requirements deleted successfully'
        });
      } else {
        return res.status(404).json({
          success: false,
          message: 'No requirements found to delete'
        });
      }
    } catch (error) {
      console.error('Error deleting requirements:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete requirements',
        message: error.message
      });
    }
  }

  return res.status(405).json({
    success: false,
    error: 'Method not allowed'
  });
}