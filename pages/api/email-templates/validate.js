import EmailTemplateMappingService from "../../../services/booking/EmailTemplateService";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  try {
    const { template } = req.body;
    if (!template) {
      return res.status(400).json({ success: false, message: 'Template required' });
    }
    const data = await EmailTemplateMappingService.validateTemplateTags(template);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
}