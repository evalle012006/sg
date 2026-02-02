'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add new columns for template protection
    await queryInterface.addColumn('email_templates', 'is_system', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'System templates cannot be deleted but can be modified'
    });
    
    await queryInterface.addColumn('email_templates', 'template_code', {
      type: Sequelize.STRING(100),
      allowNull: true,
      unique: true,
      comment: 'Unique code identifier for system templates (e.g., BOOKING_CONFIRMED)'
    });
    
    await queryInterface.addColumn('email_templates', 'required_variables', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'List of required template variables that must be preserved'
    });
    
    await queryInterface.addColumn('email_templates', 'variable_description', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Description of what each variable is used for'
    });

    // Mark system templates (IDs 14-36) as protected
    const systemTemplateIds = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36];
    
    if (systemTemplateIds.length > 0) {
      await queryInterface.sequelize.query(
        `UPDATE email_templates SET is_system = true WHERE id IN (${systemTemplateIds.join(',')})`
      );
    }

    // Set template codes for system templates
    const templateCodes = {
      14: 'booking-amended-admin',
      15: 'booking-amended',
      16: 'booking-approved',
      17: 'booking-cancelled-admin',
      18: 'booking-cancelled',
      19: 'booking-confirmed-admin',
      20: 'booking-confirmed',
      21: 'booking-declined',
      22: 'booking-notify-date-of-stay',
      23: 'booking-summary',
      24: 'course-eoi-accepted',
      25: 'course-eoi-admin',
      26: 'course-eoi-confirmation',
      27: 'course-offer-notification',
      28: 'create-account',
      29: 'email-account-termination',
      30: 'email-confirmation-link',
      31: 'guest-profile',
      32: 'icare-nights-update',
      33: 'reset-password-link',
      34: 'team-email-confirmation-link',
      35: 'booking-guest-cancellation-request',
      36: 'booking-guest-cancellation-request-admin'
    };

    for (const [id, code] of Object.entries(templateCodes)) {
      await queryInterface.sequelize.query(
        `UPDATE email_templates SET template_code = :code WHERE id = :id`,
        {
          replacements: { id: parseInt(id), code }
        }
      );
    }

    // Set required variables for critical templates
    const templateVariables = {
      14: {
        required: ['guest_name'],
        descriptions: {
          guest_name: 'Name of the guest receiving the notification'
        }
      },
      15: {
        required: ['guest_name', 'arrivalDate', 'departureDate'],
        descriptions: {
          guest_name: 'Name of the guest',
          arrivalDate: 'New arrival date',
          departureDate: 'New departure date'
        }
      },
      16: {
        required: ['guest_name', 'booking_id', 'set_new_password_link'],
        descriptions: {
          guest_name: 'Guest first name',
          booking_id: 'Booking reference ID',
          set_new_password_link: 'Link to set password for new account'
        }
      },
      17: {
        required: ['guest_name', 'arrivalDate', 'departureDate'],
        descriptions: {
          guest_name: 'Full guest name',
          arrivalDate: 'Cancelled booking arrival date',
          departureDate: 'Cancelled booking departure date'
        }
      },
      18: {
        required: ['guest_name', 'arrivalDate', 'departureDate'],
        descriptions: {
          guest_name: 'Guest first name',
          arrivalDate: 'Cancelled booking arrival date',
          departureDate: 'Cancelled booking departure date'
        }
      },
      19: {
        required: ['guest_name', 'arrivalDate', 'departureDate', 'accommodation', 'booking_package', 'booking_id'],
        descriptions: {
          guest_name: 'Full guest name',
          arrivalDate: 'Confirmed arrival date',
          departureDate: 'Confirmed departure date',
          accommodation: 'Room type(s)',
          booking_package: 'Selected package',
          booking_id: 'Booking reference'
        }
      },
      20: {
        required: ['guest_name', 'arrivalDate', 'departureDate', 'accommodation', 'booking_package', 'booking_id'],
        descriptions: {
          guest_name: 'Guest first name',
          arrivalDate: 'Confirmed arrival date',
          departureDate: 'Confirmed departure date',
          accommodation: 'Room type(s)',
          booking_package: 'Selected package',
          booking_id: 'Booking reference'
        }
      },
      21: {
        required: ['guest_name'],
        descriptions: {
          guest_name: 'Guest first name'
        }
      },
      32: {
        required: ['guest_name', 'nights_requested', 'approval_number', 'nights_used', 'nights_remaining'],
        descriptions: {
          guest_name: 'Full guest name',
          nights_requested: 'Number of nights in booking',
          approval_number: 'iCare approval reference',
          nights_used: 'Total nights used from approval',
          nights_remaining: 'Remaining nights in approval'
        }
      },
      35: {
        required: ['guest_name', 'arrivalDate', 'departureDate'],
        descriptions: {
          guest_name: 'Guest first name',
          arrivalDate: 'Booking arrival date',
          departureDate: 'Booking departure date'
        }
      },
      36: {
        required: ['guest_name', 'arrivalDate', 'departureDate'],
        descriptions: {
          guest_name: 'Full guest name',
          arrivalDate: 'Booking arrival date',
          departureDate: 'Booking departure date'
        }
      }
    };

    for (const [id, config] of Object.entries(templateVariables)) {
      await queryInterface.sequelize.query(
        `UPDATE email_templates 
         SET required_variables = :variables,
             variable_description = :descriptions
         WHERE id = :id`,
        {
          replacements: { 
            id: parseInt(id), 
            variables: JSON.stringify(config.required),
            descriptions: JSON.stringify(config.descriptions)
          }
        }
      );
    }

    console.log('✅ Email template protection fields added successfully');
    console.log(`✅ Marked ${systemTemplateIds.length} templates as system templates`);
    console.log(`✅ Set template codes for ${Object.keys(templateCodes).length} templates`);
    console.log(`✅ Set required variables for ${Object.keys(templateVariables).length} templates`);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('email_templates', 'variable_description');
    await queryInterface.removeColumn('email_templates', 'required_variables');
    await queryInterface.removeColumn('email_templates', 'template_code');
    await queryInterface.removeColumn('email_templates', 'is_system');
  }
};