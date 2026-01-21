// pages/api/bookings/[bookingId]/pdf.js
import { promises as fs } from 'fs';
import path from 'path';
import { RenderPDF } from '../../../../services/booking/exports/pdf-render';
import handlebars from 'handlebars';
import { Address, Booking, Guest, QaPair, Question, QuestionDependency, Room, RoomType, Section, Package } from '../../../../models';
import { createSummaryData } from '../../../../services/booking/create-summary-data';

export const config = {
  api: {
    responseLimit: '50mb',
  },
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
                // console.log('✅ Package resolved:', packageModel.name);
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

    const ndisQuestions = summaryData.data.ndisQuestions?.map(q => ({
      question: q.question,
      answer: Array.isArray(q.answer) ? q.answer : [q.answer]
    })) || [];

    // Read logo files
    const logoPath = path.join(process.cwd(), 'public', 'sargood-logo.png');
    const logoBase64 = await fs.readFile(logoPath, { encoding: 'base64' });
    const logoFooterPath = path.join(process.cwd(), 'public', 'sargood-footer-image.jpg');
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

    // ✅ Format NDIS package details for template with proper currency and rounding
    const formattedNdisDetails = summaryData.packageCosts.details?.map(item => ({
      package: item.package,
      lineItem: item.lineItem,
      price: `AUD ${item.price.toFixed(2)}${item.rateCategoryLabel || ''}`, // Format with AUD and rate label
      nights: `${item.quantity} ${item.rateCategoryQtyLabel || ''}`, // ✅ Use quantity property
      subtotal: `AUD ${item.total.toFixed(2)}` // ✅ Use total property and round to 2 decimals
    })) || [];

    // console.log('📊 Package costs details:', summaryData.packageCosts.details);

    const formattedData = {
      logo_base64: `data:image/png;base64,${logoBase64}`,
      logo_footer_base64: `data:image/jpeg;base64,${logoFooterBase64}`,
      app_url: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL,
      
      // Guest Information
      guest_name: summaryData.guestName,
      funder: summaryData.data.funder?.toUpperCase() || summaryData.data.funder, // ✅ Uppercase funder
      participant_number: summaryData.data.participantNumber,
      nights: summaryData.data.nights,
      dates_of_stay: summaryData.data.datesOfStay,
      isNDISFunder: isNDISFunder,
      
      // Package Information
      package_type: isNDISFunder ? summaryData.data.ndisPackage || summaryData.data.packageTypeAnswer : summaryData.data.packageTypeAnswer,
      package_cost: summaryData.data?.packageCost?.toFixed(2) || 0,
      ndis_package_type: (isNDISFunder && summaryData.data.packageType === 'HCSP') ? '1:1 STA Package' : '1:2 STA Package',
      ndis_package_details: isNDISFunder ? formattedNdisDetails : null, // ✅ Use formatted details
      total_package_cost: summaryData.packageCosts.totalCost.toFixed(2) || 0,
      has_care_fees: summaryData.packageCosts.details?.some(item => item.lineItemType === 'care'), // ✅ Check if care exists
      
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
      verbalConsent: verbalConsentData,
    };

    // console.log('📄 Template data prepared:', {
    //   hasNdisPackageDetails: !!formattedData.ndis_package_details,
    //   ndisPackageDetailsCount: formattedData.ndis_package_details?.length || 0,
    //   packageType: formattedData.package_type,
    //   isNDISFunder: formattedData.isNDISFunder
    // });
    
    if (formattedData.ndis_package_details && formattedData.ndis_package_details.length > 0) {
      // console.log('📊 First few line items in template data:');
      formattedData.ndis_package_details.slice(0, 3).forEach((item, idx) => {
        console.log(`  ${idx + 1}:`, {
          package: item.package,
          lineItem: item.lineItem,
          price: item.price,
          nights: item.nights,
          subtotal: item.subtotal
        });
      });
    } else {
      console.log('⚠️ WARNING: ndis_package_details is empty or undefined!');
      console.log('  packageCosts.details:', summaryData.packageCosts.details);
    }

    // Create temporary directory for PDF generation
    const tempDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tempDir, { recursive: true });

    // Generate unique filename
    const timestamp = new Date().getTime();
    const filename = `summary-of-stay-${uuid}-${timestamp}.pdf`;
    const pdfPath = path.join(tempDir, filename);

    // Generate PDF
    await RenderPDF({
        htmlTemplatePath: process.env.APP_ROOT + '/templates/exports/summary-of-stay.html',
        pdfData: formattedData,
        pdfPath,
        helpers: {
          isArray: function(value) {
            return Array.isArray(value);
          }
        },
        withLetterHead: true
    });

    // Read generated PDF
    const pdfBuffer = await fs.readFile(pdfPath);

    // Cleanup temporary file
    await fs.unlink(pdfPath);

    // Send PDF response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ 
      message: 'Error generating PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
}

const formatAUDate = (dateStr) => {
  return new Date(dateStr).toLocaleString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};