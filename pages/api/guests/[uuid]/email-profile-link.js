import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import puppeteer from 'puppeteer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { Address, Guest, HealthInfo } from '../../../../models';
import { getTemplatePath, getPublicDir } from '../../../../lib/paths';
import EmailService from '../../../../services/booking/emailService';
import { TEMPLATE_IDS } from '../../../../services/booking/templateIds';


const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { uuid } = req.query;
  const { adminEmail, origin, guestEmail, guestName, guestData, healthData } = req.body;

  let tempPdfPath = null;
  let browser = null;

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Fetch complete guest data from database
    const guest = await Guest.findOne({
      where: { uuid: uuid },
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Address,
        },
        {
          model: HealthInfo,
        }
      ]
    });

    if (!guest) {
      return res.status(404).json({ message: 'Guest not found' });
    }

    // Create exports/temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'templates', 'exports', 'temp');
    try {
      await mkdirAsync(tempDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }

    // Generate unique filename for PDF attachment
    const timestamp = new Date().getTime();
    tempPdfPath = path.join(tempDir, `guest-profile-${timestamp}.pdf`);

    // Register handlebars helpers
    handlebars.registerHelper('eq', function(a, b) { return a === b; });
    handlebars.registerHelper('or', function() { return Array.prototype.slice.call(arguments, 0, -1).some(Boolean); });
    handlebars.registerHelper('and', function() { return Array.prototype.slice.call(arguments, 0, -1).every(Boolean); });
    handlebars.registerHelper('isArray', function(value) { return Array.isArray(value); });
    handlebars.registerHelper('formatArray', function(arr) { return Array.isArray(arr) ? arr.join(', ') : arr; });

    // Read and compile the HTML template for PDF using path utility
    const templatePath = getTemplatePath('exports/guest-profile.html');
    console.log('📄 Using template path:', templatePath);
    const templateHtml = fs.readFileSync(templatePath, 'utf-8');
    const template = handlebars.compile(templateHtml);

    // Read logo files and convert to base64 using path utility
    const publicDir = getPublicDir();
    const logoPath = path.join(publicDir, 'sargood-logo.png');
    const logoFooterPath = path.join(publicDir, 'sargood-footer-image.jpg');
    const logo = fs.readFileSync(logoPath);
    const logoFooter = fs.readFileSync(logoFooterPath);
    const logoBase64 = `data:image/png;base64,${logo.toString('base64')}`;
    const logoFooterBase64 = `data:image/png;base64,${logoFooter.toString('base64')}`;

    // Prepare template data for PDF
    const formatAustralianDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-AU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Australia/Sydney'
      });
    };

    const formatAustralianDateTime = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleString('en-AU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Australia/Sydney',
        timeZoneName: 'short'
      });
    };

    const templateData = {
      // Basic Guest Information
      first_name: guest.first_name || guestData?.first_name || '',
      last_name: guest.last_name || guestData?.last_name || '',
      full_name: `${guest.first_name || guestData?.first_name || ''} ${guest.last_name || guestData?.last_name || ''}`.trim(),
      email: guest.email || guestData?.email || '',
      phone_number: guest.phone_number || guestData?.phone_number || '',
      dob: guest.dob || guestData?.dob || '',
      dob_formatted: formatAustralianDate(guest.dob || guestData?.dob),
      gender: guest.gender || guestData?.gender || '',
      
      // Address Information
      address: {
        street1: guest.Address?.street1 || guestData?.street_address_line_1 || '',
        street2: guest.Address?.street2 || guestData?.street_address_line_2 || '',
        city: guest.Address?.city || guestData?.city || '',
        state: guest.Address?.state_province || guestData?.state || '',
        postal: guest.Address?.postal || guestData?.post_code || '',
        country: guest.Address?.country || guestData?.country || '',
      },
      
      // Health Information
      health_info: {
        identify_aboriginal_torres: guest.HealthInfo?.identify_aboriginal_torres ?? healthData?.identify_aboriginal_torres ?? null,
        language: guest.HealthInfo?.language || healthData?.language || '',
        require_interpreter: guest.HealthInfo?.require_interpreter ?? healthData?.require_interpreter ?? null,
        cultural_beliefs: guest.HealthInfo?.cultural_beliefs || healthData?.cultural_beliefs || '',
        emergency_name: guest.HealthInfo?.emergency_name || healthData?.emergency_name || '',
        emergency_mobile_number: guest.HealthInfo?.emergency_mobile_number || healthData?.emergency_mobile_number || '',
        emergency_email: guest.HealthInfo?.emergency_email || healthData?.emergency_email || '',
        emergency_relationship: guest.HealthInfo?.emergency_relationship || healthData?.emergency_relationship || '',
        specialist_name: guest.HealthInfo?.specialist_name || healthData?.specialist_name || '',
        specialist_mobile_number: guest.HealthInfo?.specialist_mobile_number || healthData?.specialist_mobile_number || '',
        specialist_practice_name: guest.HealthInfo?.specialist_practice_name || healthData?.specialist_practice_name || '',
        sci_year: guest.HealthInfo?.sci_year || healthData?.sci_year || '',
        sci_level_asia: guest.HealthInfo?.sci_level_asia || healthData?.sci_level_asia || '',
        sci_intial_spinal_rehab: guest.HealthInfo?.sci_intial_spinal_rehab || healthData?.sci_intial_spinal_rehab || '',
        sci_type: guest.HealthInfo?.sci_type || healthData?.sci_type || '',
        sci_type_level: guest.HealthInfo?.sci_type_level || healthData?.sci_type_level || [],
        sci_inpatient: guest.HealthInfo?.sci_inpatient ?? healthData?.sci_inpatient ?? null,
        sci_injury_type: guest.HealthInfo?.sci_injury_type || healthData?.sci_injury_type || '',
        sci_other_details: guest.HealthInfo?.sci_other_details || healthData?.sci_other_details || '',
      },
      
      // Flags
      flags: guest.flags || [],

      // PDF styling
      logo_base64: logoBase64,
      logo_footer_base64: logoFooterBase64,
      
      // Profile image - intentionally empty for email PDF to avoid loading issues
      profile_image_url: '',
      
      // Generation timestamp
      generated_at: formatAustralianDateTime(new Date()),
    };

    // Generate HTML with the template
    const html = template(templateData);

    // Generate PDF using puppeteer - SIMPLE APPROACH
    console.log('🚀 Starting PDF generation for guest profile...');
    
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

    // Determine recipient email
    const recipientEmail = guestEmail || guest.email || '';
    const recipientName = guestName || templateData.full_name || 'Guest';

    if (!recipientEmail) {
      throw new Error('No recipient email address available');
    }

    // Create profile view link
    const profileViewLink = `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL}/guests/${uuid}`;

    console.log('📧 Sending guest profile email to:', recipientEmail);
    
    // ✅ Read PDF into memory before queueing
    const pdfBuffer = fs.readFileSync(tempPdfPath);
    
    EmailService.sendWithTemplateAndAttachments(
      recipientEmail,
      TEMPLATE_IDS.GUEST_PROFILE,
      { 
        guestName: recipientName,
        profileViewLink: profileViewLink,
        adminEmail: adminEmail || session.user.email,
      },
      [{
        filename: `${recipientName.replace(/\s+/g, '-').toLowerCase()}-profile.pdf`,
        content: pdfBuffer,
      }]
    );

    console.log('✅ Email sent successfully');

    // Clean up temporary file
    await unlinkAsync(tempPdfPath);
    tempPdfPath = null;

    res.status(200).json({ 
      message: 'Profile email sent successfully',
      recipient: recipientEmail 
    });

  } catch (error) {
    console.error('❌ Error in guest profile email handler:', error);
    
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
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}