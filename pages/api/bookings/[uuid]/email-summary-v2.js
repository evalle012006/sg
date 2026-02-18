import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import puppeteer from 'puppeteer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { createSummaryData } from '../../../../services/booking/create-summary-data';
import { Address, Booking, Guest, QaPair, Question, QuestionDependency, Room, RoomType, Section, Package } from '../../../../models';
import { getTemplatePath, getPublicDir } from '../../../../lib/paths';
import EmailService from '../../../../services/booking/emailService';
import { TEMPLATE_IDS } from '../../../../services/booking/templateIds';

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);

// Helper function to strip HTML tags
const stripHtmlTags = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
};

const formatAUDate = (dateStr) => {
  return new Date(dateStr).toLocaleString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { uuid } = req.query;
  const { adminEmail, origin } = req.body;

  let tempPdfPath = null;
  let browser = null;

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

    // ✅ Resolve package BEFORE calling createSummaryData
    let resolvedPackage = null;
    
    for (const section of booking.Sections) {
      for (const pair of section.QaPairs) {
        const questionKey = pair.Question?.question_key;
        const questionType = pair.Question?.question_type;
        
        if (questionType === 'package-selection' || 
            questionKey?.startsWith('please-select-your-accommodation-and-assistance-package')) {
          const packageId = pair.answer;
          
          if (packageId) {
            console.log('📦 Resolving package ID:', packageId);
            
            try {
              const packageModel = await Package.findByPk(packageId);
              
              if (packageModel) {
                console.log('✅ Package resolved:', packageModel.name);
                resolvedPackage = packageModel.toJSON();
              } else {
                console.error('❌ Package not found for ID:', packageId);
              }
            } catch (error) {
              console.error('❌ Error fetching package:', error);
            }
          }
          break;
        }
      }
      if (resolvedPackage) break;
    }

    // Pass resolved package to createSummaryData
    const summaryData = await createSummaryData(booking, resolvedPackage);

    const isNDISFunder = summaryData.data.funder?.toLowerCase().includes('ndis') || summaryData.data.funder?.toLowerCase().includes('ndia') ? true : false;

    // Verbal Consent
    const verbalConsent = typeof booking.verbal_consent == 'string' ? JSON.parse(booking.verbal_consent) : booking.verbal_consent;
    let verbalConsentData = verbalConsent ? 'Verbal consent for amendment (s) has been gained from the guest' : null;
    if (origin == 'guest' && verbalConsent) {
      verbalConsentData = `Guest verbal consent of amendment(s) to booking given to ${verbalConsent.adminName} at ${formatAUDate(verbalConsent.timestamp)}.`
    }

    // ✅ FIXED: Strip HTML tags from NDIS questions
    const ndisQuestions = summaryData.data.ndisQuestions?.map(q => ({
      question: stripHtmlTags(q.question),
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

    // Read and compile the HTML template using path utility
    const templatePath = getTemplatePath('exports/summary-of-stay.html');
    console.log('📄 Using template path:', templatePath);
    const templateHtml = fs.readFileSync(templatePath, 'utf-8');
    const template = handlebars.compile(templateHtml);

    // Read logo files and convert to base64 using path utility
    const publicDir = getPublicDir();
    const logoPath = path.join(publicDir, 'images/sargood-logo.png');
    const logoFooterPath = path.join(publicDir, 'sargood-footer-image.jpg');
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

    // ✅ Check if this is a Holiday Support Plus or Holiday Support package
    const packageCode = resolvedPackage?.package_code || summaryData.data?.packageCode || '';
    const isHolidaySupportPlus = packageCode === 'HOLIDAY_SUPPORT_PLUS';
    const isHolidaySupport = packageCode === 'HOLIDAY_SUPPORT';
    const isHSPPackage = isHolidaySupportPlus || isHolidaySupport;
    
    // ✅ UPDATED: Format NDIS package details for template with proper currency and rounding
    // Only include details if NOT any Holiday Support package (both HOLIDAY_SUPPORT and HOLIDAY_SUPPORT_PLUS)
    const formattedNdisDetails = !isHSPPackage ? (summaryData.packageCosts.details?.map(item => ({
      package: item.package,
      lineItem: item.lineItem,
      price: `AUD ${item.price.toFixed(2)}${item.rateCategoryLabel || ''}`,
      nights: `${item.quantity} ${item.rateCategoryQtyLabel || ''}`,
      subtotal: `AUD ${item.total.toFixed(2)}`
    })) || []) : null;

    // ✅ Extract care analysis data for template display
    const careAnalysis = summaryData.data.careAnalysis;
    const hasCareWithCheckInOutRules = careAnalysis?.requiresCare && 
                                        careAnalysis?.dailyCareDetails && 
                                        careAnalysis.dailyCareDetails.length > 0;
    
    // ✅ Calculate total care hours for display
    const totalCareHours = careAnalysis?.totalCareHours || 
                           (careAnalysis?.dailyCareDetails?.reduce((sum, day) => sum + day.dayTotal, 0)) || 
                           0;

    // ✅ Prepare HSP accommodation breakdown
    let hspRoomBreakdown = null;
    let hspTotalPerNight = 0;
    let hspTotalAccommodation = 0;
    
    if (isHSPPackage) {
      // For HSP packages, get rooms directly from booking (not from summaryData.rooms which filters out studios)
      const bookingRooms = booking.Rooms || [];
      
      console.log('📊 HSP Package - extracting rooms:', {
        packageCode,
        bookingRoomsCount: bookingRooms.length,
        bookingRooms: bookingRooms.map(r => ({
          label: r.label,
          type: r.RoomType?.type,
          price: r.RoomType?.price_per_night,
          hsp_pricing: r.RoomType?.hsp_pricing
        }))
      });
      
      if (bookingRooms.length > 0) {
        hspRoomBreakdown = bookingRooms.map((room, index) => {
          const roomPrice = room.RoomType?.hsp_pricing || room.RoomType?.price_per_night || 0;
          return {
            name: room.label || room.RoomType?.name || `Room ${index + 1}`,
            pricePerNight: roomPrice,
            isMainRoom: index === 0
          };
        });
        
        hspTotalPerNight = hspRoomBreakdown.reduce((sum, room) => sum + room.pricePerNight, 0);
        hspTotalAccommodation = hspTotalPerNight * summaryData.data.nights;
        
        console.log('📊 HSP breakdown calculated:', {
          hspRoomBreakdown,
          hspTotalPerNight,
          hspTotalAccommodation,
          nights: summaryData.data.nights
        });
      } else {
        console.log('⚠️ No booking rooms found for HSP package!');
      }
    }

    // Prepare template data
    const templateData = {
      // Guest Information
      guest_name: summaryData.guestName,
      funder: summaryData.data.funder?.toUpperCase() || summaryData.data.funder,
      participant_number: summaryData.data.participantNumber,
      nights: summaryData.data.nights,
      dates_of_stay: summaryData.data.datesOfStay,
      isNDISFunder: isNDISFunder,
      
      // Package Information
      package_type: isNDISFunder ? summaryData.data.ndisPackage || summaryData.data.packageTypeAnswer : summaryData.data.packageTypeAnswer,
      package_cost: summaryData.data?.packageCost?.toFixed(2) || 0,
      ndis_package_type: (isNDISFunder && summaryData.data.packageType === 'HCSP') ? '1:1 STA Package' : '1:2 STA Package',
      
      // ✅ Holiday Support flags and conditional details
      is_holiday_support_plus: isHolidaySupportPlus,
      is_holiday_support: isHolidaySupport,
      is_hsp_package: isHSPPackage,
      ndis_package_details: formattedNdisDetails,
      
      total_package_cost: summaryData.packageCosts.totalCost.toFixed(2) || 0,
      has_care_fees: summaryData.packageCosts.details?.some(item => item.lineItemType === 'care'),
      
      // ✅ Care analysis data for check-in/check-out rule display
      has_care_with_checkin_checkout_rules: hasCareWithCheckInOutRules,
      total_care_hours: totalCareHours.toFixed(1),
      care_note: hasCareWithCheckInOutRules 
        ? 'Care fees reflect requested care at the time of booking submission and may vary based on actual care hours used. Check-in day includes evening care only. Check-out day includes morning care only.'
        : (summaryData.packageCosts.details?.some(item => item.lineItemType === 'care') 
            ? 'Care fees reflect requested care at the time of booking submission and may vary based on actual care hours used.'
            : null),
      
      // ✅ HSP Room Breakdown
      hsp_room_breakdown: hspRoomBreakdown,
      hsp_total_per_night: hspTotalPerNight.toFixed(2),
      hsp_total_accommodation: hspTotalAccommodation.toFixed(2),
      
      // Room Costs (non-HSP)
      room_upgrade: summaryData.roomCosts.roomUpgrade.perNight.toFixed(2) || 0,
      additional_room: summaryData.roomCosts.additionalRoom.perNight.toFixed(2) || 0,
      total: (summaryData.roomCosts.roomUpgrade.total + summaryData.roomCosts.additionalRoom.total).toFixed(2) || 0,
      
      total_room_costs: {
        roomUpgrade: summaryData.roomCosts.roomUpgrade.total.toFixed(2),
        additionalRoom: summaryData.roomCosts.additionalRoom.total.toFixed(2),
        total: (summaryData.roomCosts.roomUpgrade.total + summaryData.roomCosts.additionalRoom.total).toFixed(2),
        hspAccommodation: hspTotalAccommodation.toFixed(2)
      },
      
      // ✅ Correct grand total calculation
      grand_total: isHSPPackage 
        ? hspTotalAccommodation.toFixed(2)
        : (summaryData.packageCosts.totalCost + summaryData.totalOutOfPocket).toFixed(2) || 0,
      
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

    // ✅ Log care analysis info
    if (templateData.has_care_fees) {
      console.log('📊 Care analysis for email:', {
        hasCareWithCheckInOutRules: templateData.has_care_with_checkin_checkout_rules,
        totalCareHours: templateData.total_care_hours,
        careNote: templateData.care_note ? 'Present' : 'None'
      });
    }

    console.log('📦 Package type for email:', {
      isHolidaySupportPlus: templateData.is_holiday_support_plus,
      isHolidaySupport: templateData.is_holiday_support,
      isHSPPackage: templateData.is_hsp_package,
      packageCode,
      hasNdisDetails: !!templateData.ndis_package_details
    });

    // Generate HTML with the template
    const html = template(templateData);

    // Generate PDF using puppeteer - SIMPLE APPROACH
    console.log('🚀 Starting PDF generation...');
    
    try {
      browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
        ],
        headless: 'new',
        timeout: 60000,
        protocolTimeout: 120000,
      });

      const page = await browser.newPage();
      
      console.log('📄 Setting page content...');
      await page.setContent(html, { 
        waitUntil: 'networkidle0',
        timeout: 60000 
      });
      
      console.log('📝 Generating PDF...');
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      });
      
      console.log('✅ PDF generated, size:', pdf.length, 'bytes');
      
      if (pdf.length === 0) {
        throw new Error('Generated PDF is empty');
      }
      
      await browser.close();
      browser = null;

      // Save PDF to temp directory
      await writeFileAsync(tempPdfPath, pdf);
      
      // Verify file was written
      const stats = fs.statSync(tempPdfPath);
      console.log('✅ PDF saved to disk, size:', stats.size, 'bytes');
      
      if (stats.size === 0) {
        throw new Error('Saved PDF file is empty');
      }

    } catch (pdfError) {
      console.error('❌ PDF generation error:', pdfError);
      if (browser) {
        try {
          await browser.close();
          browser = null;
        } catch (closeError) {
          console.error('Browser close error:', closeError);
        }
      }
      throw pdfError;
    }

    // ✅ UPDATED: Send email using EmailService with template ID
    const recipient = summaryData.guestEmail || "";
    console.log('📧 Sending email to:', recipient);
    
    // ✅ Read PDF into memory before queueing
    const pdfBuffer = fs.readFileSync(tempPdfPath);

    EmailService.sendWithTemplateAndAttachments(
      recipient,
      TEMPLATE_IDS.BOOKING_SUMMARY,
      { guestName: summaryData.guestName },
      [{
        filename: 'summary-of-stay.pdf',
        content: pdfBuffer,
      }]
    );

    console.log('✅ Email sent successfully');

    // Clean up temporary file
    await unlinkAsync(tempPdfPath);
    tempPdfPath = null;

    res.status(200).json({ message: 'Email sent successfully' });

  } catch (error) {
    console.error('❌ Error in email handler:', error);
    
    // Clean up browser if still open
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Browser cleanup error:', closeError);
      }
    }
    
    // Clean up temporary file if it exists
    if (tempPdfPath && fs.existsSync(tempPdfPath)) {
      try {
        await unlinkAsync(tempPdfPath);
      } catch (cleanupError) {
        console.error('Error cleaning up temporary file:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      message: 'Failed to send email', 
      error: error.message 
    });
  }
}