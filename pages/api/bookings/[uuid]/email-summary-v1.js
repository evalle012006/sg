import Handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import nodemailer from 'nodemailer';
import { Booking, Guest, Room, RoomType, Section, QaPair, Question } from '../../../../models';
import { createSummaryData as createSummaryDataV1 } from '../../../../services/booking/create-summary-data-v1';
import { getTemplatePath, getPublicDir } from '../../../../lib/paths';

/**
 * V1 Email PDF API
 * For old templates (ID ≤ 33)
 * Uses legacy summary data structure
 */
export default async function handler(req, res) {
  const { uuid } = req.query;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { recipient_email, origin } = req.body;

  if (!recipient_email) {
    return res.status(400).json({ message: 'Recipient email is required' });
  }

  try {
    // Fetch booking with all related data
    const booking = await Booking.findOne({
      where: { uuid },
      include: [
        {
          model: Section,
          include: [{
            model: QaPair,
            include: [{ model: Question }]
          }]
        },
        {
          model: Guest,
          attributes: { exclude: ['password', 'email_verified'] }
        },
        {
          model: Room,
          include: RoomType
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // ✅ Generate summary data using V1 processor
    console.log('📊 Generating V1 summary data for email PDF...');
    const summaryData = await createSummaryDataV1(booking);

    // ✅ Prepare template data
    const isNDISFunder = summaryData.data.funder?.toLowerCase().includes('ndis') || 
                         summaryData.data.funder?.toLowerCase().includes('ndia');

    // Format verbal consent
    const verbalConsent = typeof booking.verbal_consent === 'string' 
      ? JSON.parse(booking.verbal_consent) 
      : booking.verbal_consent;
    
    let verbalConsentData = null;
    if (verbalConsent) {
      if (origin === 'guest' && verbalConsent) {
        verbalConsentData = `Guest verbal consent of amendment(s) to booking given to ${verbalConsent.adminName} at ${formatAUDate(verbalConsent.timestamp)}.`;
      } else {
        verbalConsentData = 'Verbal consent for amendment (s) has been gained from the guest';
      }
    }

    // Format NDIS questions - ensure arrays are converted to strings
    const ndisQuestions = summaryData.data.ndisQuestions?.map(q => ({
      question: q.question,
      answer: Array.isArray(q.answer) ? q.answer.join(', ') : q.answer
    })) || [];

    // Parse signature data
    let signatureImage = null;
    let signatureDate = null;

    if (summaryData.signature) {
      const signatureData = typeof summaryData.signature === 'string'
        ? JSON.parse(summaryData.signature)
        : summaryData.signature;

      signatureImage = signatureData.image;
      signatureDate = new Date(signatureData.timestamp).toLocaleDateString('en-AU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }

    // Read logo files using path utility
    const publicDir = getPublicDir();
    const logoPath = path.join(publicDir, 'images/sargood-logo.png');
    const logoBase64 = await fs.readFile(logoPath, { encoding: 'base64' });
    const logoFooterPath = path.join(publicDir, 'sargood-footer-image.jpg');
    const logoFooterBase64 = await fs.readFile(logoFooterPath, { encoding: 'base64' });

    // Calculate totals
    const totalPackageCost = summaryData.packageCosts?.totalCost || 0;
    const totalRoomCosts = {
      roomUpgrade: summaryData.roomCosts?.roomUpgrade?.total || 0,
      additionalRoom: summaryData.roomCosts?.additionalRoom?.total || 0,
      total: summaryData.totalOutOfPocket || 0
    };
    const grandTotal = totalPackageCost + totalRoomCosts.total;

    // Prepare template context
    const templateData = {
      logo_base64: `data:image/png;base64,${logoBase64}`,
      logo_footer_base64: `data:image/jpeg;base64,${logoFooterBase64}`,
      guest_name: summaryData.guestName,
      funder: summaryData.data.funder || 'N/A',
      participant_number: summaryData.data.participantNumber || null,
      nights: summaryData.data.nights || 0,
      dates_of_stay: summaryData.data.datesOfStay || 'N/A',
      package_type: summaryData.data.packageTypeAnswer || summaryData.data.ndisPackage || 'N/A',
      package_cost: summaryData.data.packageCost || 0,
      isNDISFunder,
      ndis_package_type: isNDISFunder ? 'PACKAGE TYPE' : null,
      ndis_package_details: summaryData.packageCosts?.details || [],
      total_package_cost: totalPackageCost.toFixed(2),
      room_upgrade: summaryData.roomCosts?.roomUpgrade?.perNight || 0,
      additional_room: summaryData.roomCosts?.additionalRoom?.perNight || 0,
      total_room_costs: {
        roomUpgrade: totalRoomCosts.roomUpgrade.toFixed(2),
        additionalRoom: totalRoomCosts.additionalRoom.toFixed(2),
        total: totalRoomCosts.total.toFixed(2)
      },
      grand_total: grandTotal.toFixed(2),
      ndis_questions: ndisQuestions,
      verbalConsent: verbalConsentData,
      signature: signatureImage,
      signature_date: signatureDate
    };

    // Register Handlebars helpers
    Handlebars.registerHelper('isArray', function(value) {
      return Array.isArray(value);
    });

    Handlebars.registerHelper('lt', function(a, b) {
      return a < b;
    });

    Handlebars.registerHelper('gt', function(a, b) {
      return a > b;
    });

    Handlebars.registerHelper('gte', function(a, b) {
      return a >= b;
    });

    Handlebars.registerHelper('and', function(a, b) {
      return a && b;
    });

    // Read and compile template using path utility
    const templatePath = getTemplatePath('exports/summary-of-stay-v1.html');
    console.log('📄 Using template path:', templatePath);
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent);
    const html = template(templateData);

    // Generate PDF using Puppeteer
    console.log('📄 Generating PDF for email...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    await browser.close();

    console.log('✅ PDF generated, sending email...');

    // Configure email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Send email with PDF attachment
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@sargoodoncollaroy.com.au',
      to: recipient_email,
      subject: `Sargood on Collaroy - Summary of Stay for ${summaryData.guestName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #20485A;">Summary of Your Stay</h2>
          <p>Dear ${summaryData.guestName},</p>
          <p>Please find attached your Summary of Stay document for your upcoming booking at Sargood on Collaroy.</p>
          <p><strong>Booking Details:</strong></p>
          <ul>
            <li>Dates: ${summaryData.data.datesOfStay}</li>
            <li>Nights: ${summaryData.data.nights}</li>
            <li>Package: ${summaryData.data.packageTypeAnswer || summaryData.data.ndisPackage}</li>
          </ul>
          <p>If you have any questions, please don't hesitate to contact us.</p>
          <p>Best regards,<br>
          Sargood on Collaroy Team</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">
            1 Brissenden Avenue, Collaroy NSW 2097<br>
            Phone: +61 2 8597 0600<br>
            Email: info@sargoodoncollaroy.com.au
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `summary-of-stay-${uuid}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    await transporter.sendMail(mailOptions);

    console.log('✅ Email sent successfully to:', recipient_email);

    return res.status(200).json({ 
      message: 'Summary PDF emailed successfully',
      recipient: recipient_email
    });

  } catch (error) {
    console.error('❌ Error emailing PDF:', error);
    return res.status(500).json({ 
      message: 'Error emailing PDF', 
      error: error.message 
    });
  }
}

/**
 * Format date to AU format
 */
function formatAUDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}