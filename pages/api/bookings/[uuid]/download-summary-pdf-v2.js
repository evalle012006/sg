import { promises as fs } from 'fs';
import path from 'path';
import { RenderPDF } from '../../../../services/booking/exports/pdf-render';
import handlebars from 'handlebars';
import { Address, Booking, Guest, QaPair, Question, QuestionDependency, Room, RoomType, Section, Package } from '../../../../models';
import { createSummaryData } from '../../../../services/booking/create-summary-data';
import { getTemplatePath, getPublicDir } from '../../../../lib/paths';

export const config = {
  api: {
    responseLimit: '50mb',
  },
};

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

  try {
    const { uuid } = req.query;
    const { origin } = req.body;

    // Register helpers
    handlebars.registerHelper({
        'isArray': function(value) {
            return Array.isArray(value);
        },
        'lt': function(a, b) {
            return a < b;
        },
        'gt': function(a, b) {
            return a > b;
        },
        'gte': function(a, b) {
            return a >= b;
        },
        'and': function() {
          return Array.prototype.slice.call(arguments, 0, -1).every(Boolean);
        },
    });

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

    // Read logo files using path utility
    const publicDir = getPublicDir();
    const logoPath = path.join(publicDir, 'images/sargood-logo.png');
    const logoBase64 = await fs.readFile(logoPath, { encoding: 'base64' });
    const logoFooterPath = path.join(publicDir, 'sargood-footer-image.jpg');
    const logoFooterBase64 = await fs.readFile(logoFooterPath, { encoding: 'base64' });

    // Parse signature data
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

    const formattedData = {
      logo_base64: `data:image/png;base64,${logoBase64}`,
      logo_footer_base64: `data:image/jpeg;base64,${logoFooterBase64}`,
      app_url: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL,
      
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
      verbalConsent: verbalConsentData,
    };

    // ✅ Log care analysis info
    if (formattedData.has_care_fees) {
      console.log('📊 Care analysis for PDF:', {
        hasCareWithCheckInOutRules: formattedData.has_care_with_checkin_checkout_rules,
        totalCareHours: formattedData.total_care_hours,
        careNote: formattedData.care_note ? 'Present' : 'None'
      });
    }

    console.log('📦 Package type for PDF:', {
      isHolidaySupportPlus: formattedData.is_holiday_support_plus,
      isHolidaySupport: formattedData.is_holiday_support,
      isHSPPackage: formattedData.is_hsp_package,
      packageCode,
      hasNdisDetails: !!formattedData.ndis_package_details
    });

    // Create temporary directory for PDF generation
    const tempDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tempDir, { recursive: true });

    // Generate unique filename
    const timestamp = new Date().getTime();
    const filename = `summary-of-stay-${uuid}-${timestamp}.pdf`;
    const pdfPath = path.join(tempDir, filename);

    // Generate PDF using path utility for template
    const templatePath = getTemplatePath('exports/summary-of-stay.html');
    console.log('📄 Using template path:', templatePath);

    await RenderPDF({
        htmlTemplatePath: templatePath,
        pdfData: formattedData,
        pdfPath,
        helpers: {
          isArray: function(value) {
            return Array.isArray(value);
          }
        },
        withLetterHead: true
    });

    // Verify PDF was created
    const stats = await fs.stat(pdfPath);
    console.log('✅ PDF generated, size:', stats.size, 'bytes');
    
    if (stats.size === 0) {
      throw new Error('Generated PDF is empty');
    }

    // Read generated PDF
    const pdfBuffer = await fs.readFile(pdfPath);
    
    if (pdfBuffer.length === 0) {
      throw new Error('PDF buffer is empty');
    }

    // Cleanup temporary file
    await fs.unlink(pdfPath);

    // Send PDF response with proper headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ 
      message: 'Error generating PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
}