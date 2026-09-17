'use strict';

const BOOKING_CONFIRMATION_HTML = `
<!DOCTYPE html>
<html lang="en-US">
<head>
    <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Confirmation - Sargood on Collaroy</title>
    <style type="text/css">
        body { margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #1f2937; }
        .container { max-width: 560px; margin: 0 auto; background-color: #ffffff; padding: 40px; }
        h1 { color: #075985; font-size: 22px; font-weight: 600; margin: 0 0 24px 0; }
        p { margin: 0 0 16px 0; }
        .details-box { background-color: #f9fafb; border-left: 3px solid #075985; padding: 20px; margin: 24px 0; }
        .details-box h2 { font-size: 14px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 16px 0; }
        .detail-row { display: block; margin-bottom: 12px; }
        .detail-label { color: #6b7280; font-size: 13px; display: block; margin-bottom: 2px; }
        .detail-value { color: #1f2937; font-weight: 500; }
        .divider { border: none; border-top: 1px solid #e5e7eb; margin: 32px 0; }
        .footer { color: #6b7280; font-size: 13px; }
        .footer a { color: #075985; text-decoration: none; }
        a { color: #075985; }
        .logo { text-align: center; margin-bottom: 32px; }
        .logo img { max-width: 200px; height: auto; }
        @media only screen and (max-width: 600px) {
            .container { width: 100% !important; padding: 20px !important; }
        }
    </style>
</head>
<body>
    <div class="container">
        {{#if logo_base64}}
        <div class="logo">
            <img src="{{logo_base64}}" alt="Sargood on Collaroy" />
        </div>
        {{/if}}
        <h1>Your Booking Confirmation</h1>

        <p>Hi {{guest_name}},</p>

        <p>Attached is a PDF confirmation of your upcoming stay at Sargood on Collaroy.</p>

        <div class="details-box">
            <h2>Booking Details</h2>
            <div class="detail-row">
                <span class="detail-label">Dates of Stay</span>
                <span class="detail-value">{{dates_of_stay}}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Room</span>
                <span class="detail-value">{{room_label}}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Booking Reference</span>
                <span class="detail-value">{{booking_reference}}</span>
            </div>
        </div>

        <p>If anything above looks incorrect, please get in touch with our team and we'll help sort it out.</p>

        <hr class="divider">

        <div class="footer">
            <p><strong>Sargood on Collaroy</strong></p>
            <p>
                Phone: <a href="tel:0285970600">02 8597 0600</a><br>
                Email: <a href="mailto:info@sargoodoncollaroy.com.au">info@sargoodoncollaroy.com.au</a>
            </p>
            <p style="margin-top: 16px; font-size: 12px; color: #9ca3af;">
                1 Brissenden Avenue, Collaroy NSW 2097, Australia
            </p>
        </div>
    </div>
</body>
</html>
`;

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();

    // 1. Feature-restriction setting: which booking statuses can generate/email
    //    the confirmation PDF. NULL/empty (not the case here) would mean "all statuses" -
    //    default here is restricted to booking_confirmed only, per requirement.
    await queryInterface.bulkInsert('settings', [
      {
        attribute: 'booking_confirmation_pdf_allowed_statuses',
        value: JSON.stringify(['booking_confirmed']),
      },
    ]);

    // 2. New system email template used when emailing the confirmation PDF.
    //    Referenced by template_code (not by numeric id) for environment safety.
    await queryInterface.bulkInsert('email_templates', [
      {
        name: 'Booking Confirmation PDF',
        template_code: 'booking-confirmation-pdf',
        subject: 'Your Sargood on Collaroy booking confirmation',
        description: 'Sent when an admin emails a guest their booking confirmation PDF from the booking list or booking details page.',
        html_content: BOOKING_CONFIRMATION_HTML.trim(),
        template_type: 'system',
        is_active: true,
        is_system: true,
        required_variables: JSON.stringify(['guest_name']),
        variable_description: JSON.stringify({
          guest_name: 'Guest first name',
          dates_of_stay: 'Formatted check-in - check-out date range',
          room_label: 'Room / room type label',
          booking_reference: 'Booking reference id',
        }),
        createdAt: now,
        updatedAt: now,
      },
    ]);

    console.log('✅ Added booking_confirmation_pdf_allowed_statuses setting and booking-confirmation-pdf email template');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('settings', {
      attribute: 'booking_confirmation_pdf_allowed_statuses',
    });

    await queryInterface.bulkDelete('email_templates', {
      template_code: 'booking-confirmation-pdf',
    });
  },
};