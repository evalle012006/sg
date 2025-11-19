import { Guest, GuestApproval, Package, RoomType, BookingApprovalUsage } from '../../../../../models';

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
      const approvals = await GuestApproval.findAll({
        where: { guest_id: guest.id },
        include: [
          {
            model: Package,
            as: 'package',
            attributes: ['id', 'name', 'package_code', 'funder']
          },
          {
            model: RoomType,
            as: 'additionalRoomType',
            attributes: ['id', 'name', 'type']
          },
          {
            model: BookingApprovalUsage,
            as: 'usages',
            attributes: ['id', 'booking_id', 'nights_consumed', 'room_type', 'status']
          }
        ],
        order: [['approval_from', 'DESC']]
      });
      
      // Format response with calculated fields
      const formattedApprovals = approvals.map(approval => ({
        id: approval.id,
        approval_name: approval.approval_name,
        approval_number: approval.approval_number,
        approval_type: approval.approval_type,
        nights_approved: approval.nights_approved,
        nights_used: approval.nights_used,
        nights_remaining: approval.getRemainingNights(),
        package_id: approval.package_id,
        package: approval.package,
        approval_from: approval.approval_from,
        approval_to: approval.approval_to,
        additional_room_approved: approval.additional_room_approved,
        additional_room_type: approval.additionalRoomType,
        additional_room_nights_approved: approval.additional_room_nights_approved,
        additional_room_nights_used: approval.additional_room_nights_used,
        additional_room_nights_remaining: approval.getRemainingAdditionalNights(),
        status: approval.status,
        is_valid: approval.isValid(),
        usages: approval.usages,
        created_at: approval.created_at,
        updated_at: approval.updated_at
      }));
      
      res.status(200).json(formattedApprovals);
    } catch (error) {
      console.error('Error fetching approvals:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  else if (req.method === 'POST') {
    try {
      const { 
        approval_name,
        approval_number, 
        approval_type,
        nights_approved, 
        package_id, 
        approval_from, 
        approval_to,
        additional_room_approved,
        additional_room_nights_approved
      } = req.body;
      
      // Validate package if provided
      if (package_id) {
        const packageExists = await Package.findByPk(package_id);
        if (!packageExists) {
          return res.status(400).json({ message: 'Invalid package selected' });
        }
      }

      // Validate room type if provided
      if (additional_room_approved) {
        const roomTypeExists = await RoomType.findByPk(additional_room_approved);
        if (!roomTypeExists) {
          return res.status(400).json({ message: 'Invalid room type selected' });
        }
      }
      
      const newApproval = await GuestApproval.create({
        guest_id: guest.id,
        approval_name: approval_name || null,
        approval_number: approval_number || null,
        approval_type: approval_type || 'icare',
        nights_approved: parseInt(nights_approved) || 0,
        nights_used: 0,
        package_id: package_id || null,
        approval_from: approval_from || null,
        approval_to: approval_to || null,
        additional_room_approved: additional_room_approved || null,
        additional_room_nights_approved: parseInt(additional_room_nights_approved) || 0,
        additional_room_nights_used: 0,
        status: 'active'
      });
      
      res.status(201).json({ 
        message: 'Approval created successfully',
        approval: newApproval
      });
      
    } catch (error) {
      console.error('Error creating approval:', error);
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  }
  
  else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({ message: 'Method not allowed' });
  }
}