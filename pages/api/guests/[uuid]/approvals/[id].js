import { Guest, GuestApproval, Package, RoomType } from '../../../../../models';

export default async function handler(req, res) {
  const { uuid, id } = req.query;
  
  const guest = await Guest.findOne({ 
    where: { uuid },
    attributes: ['id', 'uuid'] 
  });
  
  if (!guest) {
    return res.status(404).json({ message: 'Guest not found' });
  }
  
  if (req.method === 'PUT') {
    try {
      const approval = await GuestApproval.findOne({
        where: { id, guest_id: guest.id }
      });
      
      if (!approval) {
        return res.status(404).json({ message: 'Approval not found' });
      }
      
      const { 
        approval_name,
        approval_number, 
        approval_type,
        nights_approved, 
        package_id, 
        approval_from, 
        approval_to,
        additional_room_approved,
        additional_room_nights_approved,
        status
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
      
      await approval.update({
        approval_name: approval_name !== undefined ? approval_name : approval.approval_name,
        approval_number: approval_number !== undefined ? approval_number : approval.approval_number,
        approval_type: approval_type || approval.approval_type,
        nights_approved: nights_approved !== undefined ? parseInt(nights_approved) : approval.nights_approved,
        package_id: package_id !== undefined ? package_id : approval.package_id,
        approval_from: approval_from !== undefined ? approval_from : approval.approval_from,
        approval_to: approval_to !== undefined ? approval_to : approval.approval_to,
        additional_room_approved: additional_room_approved !== undefined ? additional_room_approved : approval.additional_room_approved,
        additional_room_nights_approved: additional_room_nights_approved !== undefined ? parseInt(additional_room_nights_approved) : approval.additional_room_nights_approved,
        status: status || approval.status
      });
      
      res.status(200).json({ 
        message: 'Approval updated successfully',
        approval
      });
      
    } catch (error) {
      console.error('Error updating approval:', error);
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  }
  
  else if (req.method === 'DELETE') {
    try {
      const approval = await GuestApproval.findOne({
        where: { id, guest_id: guest.id }
      });
      
      if (!approval) {
        return res.status(404).json({ message: 'Approval not found' });
      }
      
      await approval.destroy();
      
      res.status(200).json({ message: 'Approval deleted successfully' });
      
    } catch (error) {
      console.error('Error deleting approval:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  else {
    res.setHeader('Allow', ['PUT', 'DELETE']);
    res.status(405).json({ message: 'Method not allowed' });
  }
}