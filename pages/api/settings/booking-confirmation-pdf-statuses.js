import { getAllowedStatuses } from '../../../services/booking/confirmationPdfAccess';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const allowedStatuses = await getAllowedStatuses();
  // Empty array means "no restriction - available for all statuses".
  res.status(200).json({ allowedStatuses });
}