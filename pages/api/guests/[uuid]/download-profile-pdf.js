import { RenderPDF } from '../../../../services/booking/exports/pdf-render';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { Address, Guest, HealthInfo } from '../../../../models';
import path from 'path';
import { promises as fs } from 'fs';
import { getTemplatePath, getPublicDir } from '../../../../lib/paths';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { uuid } = req.query;
  const { origin, guestData, healthData, profileImageUrl } = req.body;

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

    // Read logo files using path utility
    const publicDir = getPublicDir();
    const logoPath = path.join(publicDir, 'sargood-logo.png');
    const logoBase64 = await fs.readFile(logoPath, { encoding: 'base64' });
    const logoFooterPath = path.join(publicDir, 'sargood-footer-image.jpg');
    const logoFooterBase64 = await fs.readFile(logoFooterPath, { encoding: 'base64' });

    // Format guest profile data
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

    const formattedData = {
      logo_base64: `data:image/png;base64,${logoBase64}`,
      logo_footer_base64: `data:image/jpeg;base64,${logoFooterBase64}`,
      app_url: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL,
      
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
      
      // Profile Image - ensure it's a valid URL or empty
      profile_image_url: profileImageUrl && typeof profileImageUrl === 'string' && profileImageUrl.trim() !== '' 
        ? profileImageUrl 
        : '',
      
      // Flags
      flags: guest.flags || [],
      
      // Generation timestamp
      generated_at: formatAustralianDateTime(new Date()),
    };

    console.log('Profile image URL being used:', formattedData.profile_image_url);

    // Create temporary directory for PDF generation
    const tempDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tempDir, { recursive: true });

    // Generate unique filename
    const timestamp = new Date().getTime();
    const filename = `guest-profile-${uuid}-${timestamp}.pdf`;
    const pdfPath = path.join(tempDir, filename);

    // Generate PDF using path utility for template
    const templatePath = getTemplatePath('exports/guest-profile.html');
    console.log('📄 Using template path:', templatePath);

    await RenderPDF({
        htmlTemplatePath: templatePath,
        pdfData: formattedData,
        pdfPath,
        helpers: {
          isArray: function(value) {
            return Array.isArray(value);
          },
          eq: function(a, b) {
            return a === b;
          },
          or: function() {
            return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
          },
          and: function() {
            return Array.prototype.slice.call(arguments, 0, -1).every(Boolean);
          },
          formatArray: function(arr) {
            return Array.isArray(arr) ? arr.join(', ') : arr;
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
    console.error('Error generating guest profile PDF:', error);
    res.status(500).json({ 
      message: 'Error generating PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
}