import { Checklist, ChecklistAction } from "./../../../../models";

export default async function handler(req, res) {
  try {
    const { bookingId } = req.query;
    
    const checkList = await Checklist.findOne({ 
      where: { 
        booking_id: bookingId 
      },
      include: [{
        model: ChecklistAction,
        order: [['order', 'ASC']]
      }],
      order: [
        [ChecklistAction, 'order', 'ASC'] 
      ]
    });

    if (!checkList) {
      return res.status(404).json({ 
        success: false, 
        message: 'Checklist not found' 
      });
    }

    return res.status(200).json(checkList);
    
  } catch (error) {
    console.error('Error retrieving checklist:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}