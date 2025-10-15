import EmailTemplateMappingService from "../../../services/booking/EmailTemplateService";
import { Booking, Section, QaPair, Room, RoomType, Guest } from '../../../models';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  try {
    const { template, bookingUuid } = req.body;
    if (!template) {
      return res.status(400).json({ success: false, message: 'Template required' });
    }
    
    let resolved = template;
    if (bookingUuid) {
      const booking = await Booking.findOne({
        where: { uuid: bookingUuid },
        include: [
          { model: Section, include: [{ model: QaPair, include: ['Question'] }] },
          { model: Room, include: [RoomType] },
          Guest
        ]
      });
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }
      resolved = await EmailTemplateMappingService.resolveMergeTags(booking, template);
    } else {
      // Sample data
      const sample = {
        Guest: { first_name: 'John', last_name: 'Doe', email: 'john@example.com', phone_number: '0412345678' },
        reference_id: 'BK-2025-001',
        Rooms: [{ checkin: '2025-03-15', checkout: '2025-03-20', total_guests: 2, adults: 2, RoomType: { name: 'Ocean View Suite' } }],
        Sections: []
      };
      resolved = await EmailTemplateMappingService.resolveMergeTags(sample, template);
    }
    
    return res.status(200).json({ success: true, data: { original: template, resolved } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
}