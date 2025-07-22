import SendEmail from '../../../../utilities/mail';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import puppeteer from 'puppeteer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { createSummaryData } from '../../../../services/booking/create-summary-data';
import { Address, Booking, Guest, QaPair, Question, QuestionDependency, Room, RoomType, Section } from '../../../../models';

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { uuid } = req.query;
  const { adminEmail, origin } = req.body;

  let tempPdfPath = null;

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Fetch complete booking data
    const booking = await Booking.findOne({
      where: { uuid: uuid },
      include: [
          {
              model: Section,
              include: [
                  {
                      model: QaPair,
                      include: [
                          {
                              model: Question,
                              include: [
                                  {
                                      model: QuestionDependency,
                                      include: ['dependency']
                                  }
                              ],
                              raw: true
                          }
                      ]
                  }
              ],
              order: [['order', 'ASC']]
          },
          {
              model: Guest,
              attributes: { exclude: ['password', 'email_verified'] },
              include: Address
          },
          { 
              model: Room, 
              include: RoomType 
          }
      ],
  });

  if (!booking) {
    return res.status(404).json({ message: 'Booking not found' });
  }

    const summaryData = await createSummaryData(booking);

    const isNDISFunder = summaryData.data.funder.includes('NDIS') || summaryData.data.funder.includes('NDIA') ? true : false;

    // Verbal Consent
    const verbalConsent = typeof booking.verbal_consent == 'string' ? JSON.parse(booking.verbal_consent) : booking.verbal_consent;
    let verbalConsentData = verbalConsent ? 'Verbal consent for amendment (s) has been gained from the guest' : null;
    if (origin == 'guest' && verbalConsent) {
      verbalConsentData = `Guest verbal consent of amendment(s) to booking given to ${verbalConsent.adminName} at ${formatAUDate(verbalConsent.timestamp)}.`
    }

    const ndisQuestions = summaryData.data.ndisQuestions?.map(q => ({
      question: q.question,
      answer: Array.isArray(q.answer) ? q.answer : [q.answer]
    })) || [];

    // Create exports/temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'templates', 'exports', 'temp');
    try {
      await mkdirAsync(tempDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }

    // Generate unique filename
    const timestamp = new Date().getTime();
    tempPdfPath = path.join(tempDir, `summary-${timestamp}.pdf`);

    // Register handlebars helpers
    handlebars.registerHelper('lt', function(a, b) { return a < b; });
    handlebars.registerHelper('gt', function(a, b) { return a > b; });
    handlebars.registerHelper('gte', function(a, b) { return a >= b; });
    handlebars.registerHelper('isArray', function(value) { return Array.isArray(value); });
    handlebars.registerHelper('and', function() { return Array.prototype.slice.call(arguments, 0, -1).every(Boolean); });

    // Read and compile the HTML template
    const templatePath = path.join(process.cwd(), 'templates', 'exports', 'summary-of-stay.html');
    const templateHtml = fs.readFileSync(templatePath, 'utf-8');
    const template = handlebars.compile(templateHtml);

    // Read logo files and convert to base64
    const logoPath = path.join(process.cwd(), 'public', 'sargood-logo.png');
    const logoFooterPath = path.join(process.cwd(), 'public', 'sargood-footer-image.jpg');
    const logo = fs.readFileSync(logoPath);
    const logoFooter = fs.readFileSync(logoFooterPath);
    const logoBase64 = `data:image/png;base64,${logo.toString('base64')}`;
    const logoFooterBase64 = `data:image/png;base64,${logoFooter.toString('base64')}`;

    let signatureImage = null;
    let signatureDate = null;

    if (summaryData.signature) {
      const signatureData = typeof summaryData.signature === 'string' 
        ? JSON.parse(summaryData.signature) 
        : summaryData.signature;

      signatureImage = signatureData.image;
      signatureDate = new Date(signatureData.timestamp).toLocaleString('en-AU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Australia/Sydney',
        timeZoneName: 'short'
      });
    }

    // Prepare template data
    const templateData = {
      // Guest Information
      guest_name: summaryData.guestName,
      funder: summaryData.data.funder,
      participant_number: summaryData.data.participantNumber,
      nights: summaryData.data.nights,
      dates_of_stay: summaryData.data.datesOfStay,
      isNDISFunder: isNDISFunder,
      
      // Package Information
      package_type: isNDISFunder ? summaryData.data.ndisPackage : summaryData.data.packageTypeAnswer,
      package_cost: summaryData.data?.packageCost?.toFixed(2) || 0,
      ndis_package_type: (isNDISFunder && summaryData.data.packageType === 'HCSP') ? '1:1 STA Package' : '1:2 STA Package',
      ndis_package_details: isNDISFunder ? summaryData.packageCosts.details : null,
      total_package_cost: summaryData.packageCosts.totalCost.toFixed(2) || 0,
      
      // Room Costs
      room_upgrade: summaryData.roomCosts.roomUpgrade.perNight.toFixed(2) || 0,
      additional_room: summaryData.roomCosts.additionalRoom.perNight.toFixed(2) || 0,
      total: (summaryData.roomCosts.roomUpgrade.total + summaryData.roomCosts.additionalRoom.total).toFixed(2) || 0,
      
      total_room_costs: {
        roomUpgrade: summaryData.roomCosts.roomUpgrade.total.toFixed(2),
        additionalRoom: summaryData.roomCosts.additionalRoom.total.toFixed(2),
        total: (summaryData.roomCosts.roomUpgrade.total + summaryData.roomCosts.additionalRoom.total).toFixed(2)
      },
      grand_total: (summaryData.packageCosts.totalCost + summaryData.totalOutOfPocket).toFixed(2) || 0,
      
      // NDIS Questions if applicable
      ndis_questions: ndisQuestions,
      ndis_questions_size: ndisQuestions.length,

      // Signature
      signature: signatureImage,
      signature_date: signatureDate,

      logo_base64: logoBase64,
      logo_footer_base64: logoFooterBase64,
      verbalConsent: verbalConsentData,
    };

    // Generate HTML with the template
    const html = template(templateData);

    // Generate PDF using puppeteer
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
    await browser.close();

    // Save PDF to temp directory
    await writeFileAsync(tempPdfPath, pdf);

    // Send email with PDF attachment
    // const recipient = adminEmail || summaryData.guestEmail;
    const recipient = summaryData.guestEmail || "";
    console.log('Sending email to:', recipient);
    await SendEmail(
      recipient,
      'Summary of Your Stay - Sargood on Collaroy',
      'booking-summary',
      { guestName: summaryData.guestName },
      [{
        filename: 'summary-of-stay.pdf',
        path: tempPdfPath,
      }]
    );

    // Clean up temporary file
    await unlinkAsync(tempPdfPath);
    tempPdfPath = null;

    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    
    // Clean up temporary file if it exists
    if (tempPdfPath && fs.existsSync(tempPdfPath)) {
      try {
        await unlinkAsync(tempPdfPath);
      } catch (cleanupError) {
        console.error('Error cleaning up temporary file:', cleanupError);
      }
    }
    
    res.status(500).json({ message: 'Failed to send email', error: error.message });
  }
}