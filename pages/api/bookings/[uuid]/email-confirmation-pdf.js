import { promises as fs } from 'fs';
import path from 'path';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { RenderPDF } from '../../../../services/booking/exports/pdf-render';
import { Booking, Guest, Room, RoomType, Section, QaPair, Question, Equipment, CourseOffer, Course } from '../../../../models';
import { createBookingConfirmationData, getBookingConfirmationPdfHeaderFooter } from '../../../../services/booking/create-booking-confirmation-data';
import { isConfirmationPdfAllowed } from '../../../../services/booking/confirmationPdfAccess';
import { getTemplatePath } from '../../../../lib/paths';
import EmailService from '../../../../services/booking/emailService';

export const config = {
  api: {
    responseLimit: '50mb',
  },
};

const TEMPLATE_CODE = 'booking-confirmation-pdf';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { uuid } = req.query;
  let tempPdfPath = null;

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const booking = await Booking.findOne({
      where: { uuid },
      include: [
        { model: Guest, attributes: { exclude: ['password', 'email_verified'] } },
        { model: Room, include: RoomType },
        {
          model: Section,
          include: [{ model: QaPair, include: [{ model: Question }] }],
        },
        { model: Equipment },
        { model: CourseOffer, as: 'courseOffers', include: [{ model: Course, as: 'course' }] },
      ],
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const allowed = await isConfirmationPdfAllowed(booking);
    if (!allowed) {
      return res.status(403).json({
        message: 'Booking confirmation PDF is not available for this booking.',
      });
    }

    const pdfData = await createBookingConfirmationData(booking);

    const recipient = pdfData.guest_email;
    if (!recipient) {
      return res.status(400).json({ message: 'This guest has no email address on file.' });
    }

    const templatePath = getTemplatePath('exports/booking-confirmation.html');

    const tempDir = path.join(process.cwd(), 'templates', 'exports', 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    const filename = `booking-confirmation-${uuid}-${Date.now()}.pdf`;
    tempPdfPath = path.join(tempDir, filename);

    const { headerTemplate, footerTemplate, margin } = getBookingConfirmationPdfHeaderFooter();

    await RenderPDF({
      htmlTemplatePath: templatePath,
      pdfData,
      pdfPath: tempPdfPath,
      withLetterHead: true,
      headerTemplate,
      footerTemplate,
      margin,
    });

    const pdfBuffer = await fs.readFile(tempPdfPath);
    if (pdfBuffer.length === 0) {
      throw new Error('Generated PDF is empty');
    }
    console.log(`📎 Booking confirmation PDF generated: ${pdfBuffer.length} bytes for booking ${uuid}`);

    await EmailService.sendWithTemplateAndAttachments(
      recipient,
      TEMPLATE_CODE,
      {
        guest_name: pdfData.guest_name,
        dates_of_stay: pdfData.dates_of_stay,
        room_label: pdfData.room_label,
        booking_reference: pdfData.booking_reference,
      },
      [{
        filename: 'booking-confirmation.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf',
      }]
    );

    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('❌ Error emailing booking confirmation PDF:', error);
    res.status(500).json({
      message: 'Failed to send email',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    if (tempPdfPath) {
      try {
        await fs.unlink(tempPdfPath);
      } catch (e) {
        // best-effort cleanup
      }
    }
  }
}