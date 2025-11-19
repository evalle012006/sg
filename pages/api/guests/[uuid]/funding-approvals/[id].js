import { Guest, FundingApproval, Package, RoomType } from "../../../../../models";

export default async function handler(req, res) {
  const { uuid, id } = req.query;
  
  const guest = await Guest.findOne({ 
    where: { uuid },
    attributes: ['id', 'uuid'] 
  });
  
  if (!guest) {
    return res.status(404).json({ message: 'Guest not found' });
  }

  if (req.method === 'GET') {
    try {
      const approval = await FundingApproval.findOne({
        where: { 
          id: id,
          guest_id: guest.id 
        },
        include: [
          {
            model: Package,
            as: 'package'
          },
          {
            model: RoomType,
            as: 'additionalRoomType'
          }
        ]
      });

      if (!approval) {
        return res.status(404).json({
          success: false,
          message: 'Funding approval not found'
        });
      }

      res.status(200).json({
        success: true,
        data: approval
      });
    } catch (error) {
      console.error('Error fetching funding approval:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching funding approval',
        error: error.message
      });
    }
  }
  
  else if (req.method === 'PUT') {
    try {
      const approval = await FundingApproval.findOne({
        where: { 
          id: id,
          guest_id: guest.id 
        }
      });

      if (!approval) {
        return res.status(404).json({
          success: false,
          message: 'Funding approval not found'
        });
      }

      await approval.update(req.body);

      const updatedApproval = await FundingApproval.findByPk(approval.id, {
        include: [
          {
            model: Package,
            as: 'package'
          },
          {
            model: RoomType,
            as: 'additionalRoomType'
          }
        ]
      });

      res.status(200).json({
        success: true,
        message: 'Funding approval updated successfully',
        data: updatedApproval
      });
    } catch (error) {
      console.error('Error updating funding approval:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating funding approval',
        error: error.message
      });
    }
  }
  
  else if (req.method === 'DELETE') {
    try {
      const approval = await FundingApproval.findOne({
        where: { 
          id: id,
          guest_id: guest.id 
        }
      });

      if (!approval) {
        return res.status(404).json({
          success: false,
          message: 'Funding approval not found'
        });
      }

      await approval.destroy();

      res.status(200).json({
        success: true,
        message: 'Funding approval deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting funding approval:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting funding approval',
        error: error.message
      });
    }
  }
  
  else {
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    res.status(405).json({ message: 'Method not allowed' });
  }
}