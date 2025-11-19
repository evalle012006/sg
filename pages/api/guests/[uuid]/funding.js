import { Guest, GuestApproval, Package, RoomType } from '../../../../models';

export default async function handler(req, res) {
  const { uuid } = req.query;
  
  // Log deprecation warning
  console.warn(`⚠️  DEPRECATED: /api/guests/${uuid}/funding endpoint called. Use /api/guests/${uuid}/approvals instead.`);
  
  const guest = await Guest.findOne({ 
    where: { uuid },
    attributes: ['id', 'uuid'] 
  });
  
  if (!guest) {
    return res.status(404).json({ message: 'Guest not found' });
  }
  
  if (req.method === 'GET') {
    // Return deprecation notice with the most recent active approval
    try {
      const approval = await GuestApproval.findOne({
        where: { 
          guest_id: guest.id,
          status: 'active'
        },
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
          }
        ],
        order: [['created_at', 'DESC']]
      });
      
      let response = {
        _deprecated: true,
        _message: 'This endpoint is deprecated. Please use /api/guests/[uuid]/approvals instead.',
        _migration_guide: 'The system now supports multiple approvals per guest.',
        approval_number: '',
        nights_approved: '',
        package_id: null,
        package_approved: '',
        approval_from: '',
        approval_to: '',
        nights_used: 0,
        additional_room_approved: null,
        additional_room_nights_approved: 0,
        additional_room_nights_used: 0
      };
      
      if (approval) {
        let packageDisplay = '';
        if (approval.package) {
          packageDisplay = approval.package.package_code 
            ? `${approval.package.name} (${approval.package.package_code})`
            : approval.package.name;
        }

        response = {
          ...response,
          approval_number: approval.approval_number || '',
          nights_approved: approval.nights_approved || '',
          package_id: approval.package_id || null,
          package_approved: packageDisplay,
          approval_from: approval.approval_from || '',
          approval_to: approval.approval_to || '',
          nights_used: approval.nights_used || 0,
          additional_room_approved: approval.additional_room_approved || null,
          additional_room_nights_approved: approval.additional_room_nights_approved || 0,
          additional_room_nights_used: approval.additional_room_nights_used || 0
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
    return res.status(410).json({ 
      _deprecated: true,
      error: 'Endpoint deprecated',
      message: 'This endpoint is no longer supported. Please use POST /api/guests/[uuid]/approvals to create new approvals.',
      migration_guide: 'The system now supports multiple approvals per guest. Use the new approvals endpoint.'
    });
  }
  
  else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({ message: 'Method not allowed' });
  }
}