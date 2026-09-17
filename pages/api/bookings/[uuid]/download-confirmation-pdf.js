import { promises as fs } from 'fs';
import path from 'path';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { RenderPDF } from '../../../../services/booking/exports/pdf-render';
import { Booking, Guest, Room, RoomType, Section, QaPair, Question, Equipment, CourseOffer, Course } from '../../../../models';
import { createBookingConfirmationData, getBookingConfirmationPdfHeaderFooter } from '../../../../services/booking/create-booking-confirmation-data';
import { isConfirmationPdfAllowed } from '../../../../services/booking/confirmationPdfAccess';
import { getTemplatePath } from '../../../../lib/paths';

export const config = {
  api: {
    responseLimit: '50mb',
  },
};

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

    // Server-side enforcement of the status restriction - never trust the
    // client-side menu-hiding alone.
    const allowed = await isConfirmationPdfAllowed(booking);
    if (!allowed) {
      return res.status(403).json({
        message: 'Booking confirmation PDF is not available for this booking.',
      });
    }

    const pdfData = await createBookingConfirmationData(booking);

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

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="booking-confirmation-${uuid}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error('❌ Error generating booking confirmation PDF:', error);
    res.status(500).json({
      message: 'Error generating PDF',
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