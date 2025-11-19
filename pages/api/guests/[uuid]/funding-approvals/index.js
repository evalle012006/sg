import { Guest, FundingApproval, Package, RoomType } from '../../../../../models';

export default async function handler(req, res) {
  const { uuid } = req.query;
  
  const guest = await Guest.findOne({ 
    where: { uuid },
    attributes: ['id', 'uuid'] 
  });
  
  if (!guest) {
    return res.status(404).json({ message: 'Guest not found' });
  }

  if (req.method === 'GET') {
    try {
      // Get all funding approvals for this specific guest
      const fundingApprovals = await FundingApproval.findAll({
        where: { guest_id: guest.id },
        include: [
          {
            model: Package,
            as: 'package',
            attributes: ['id', 'name', 'package_code']
          },
          {
            model: RoomType,
            as: 'additionalRoomType',
            attributes: ['id', 'name']
          }
        ],
        order: [['approval_from', 'ASC']]
      });

      res.status(200).json({
        success: true,
        data: fundingApprovals
      });
    } catch (error) {
      console.error('Error fetching guest funding approvals:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching guest funding approvals',
        error: error.message
      });
    }
  }

  else if (req.method === 'POST') {
    try {
      const approvalData = {
        ...req.body,
        guest_id: guest.id,
        funding_type: 'icare' // Always icare
      };

      const fundingApproval = await FundingApproval.create(approvalData);

      const approvalWithRelations = await FundingApproval.findByPk(fundingApproval.id, {
        include: [
          {
            model: Package,
            as: 'package',
            attributes: ['id', 'name', 'package_code']
          },
          {
            model: RoomType,
            as: 'additionalRoomType',
            attributes: ['id', 'name']
          }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'Funding approval created successfully',
        data: approvalWithRelations
      });
    } catch (error) {
      console.error('Error creating funding approval:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating funding approval',
        error: error.message
      });
    }
  }

  else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({ message: 'Method not allowed' });
  }
}