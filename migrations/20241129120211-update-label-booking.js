'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.sequelize.transaction(async (t) => {
      const bookings = await queryInterface.sequelize.query(
        'SELECT id, label FROM bookings WHERE label IS NOT NULL',
        { transaction: t }
      );

      await queryInterface.addColumn('bookings', 'label_json', {
        type: Sequelize.JSON
      }, { transaction: t });

      if (bookings[0].length > 0) {
        for (const booking of bookings[0]) {
          try {
            let finalValue;
            let parsedLabel = typeof booking.label === 'object' ? 
              booking.label : 
              JSON.parse(booking.label);
            
            if (parsedLabel.value && parsedLabel.label) {
              // Case: {"label": "Waiting on iCare Confirmation", "value": "waiting_icare_confirmation"}
              finalValue = [parsedLabel.value];
            } else if (typeof parsedLabel === 'object' && parsedLabel.value) {
              // Case: {"value": "some_value"}
              finalValue = [parsedLabel.value];
            } else {
              // Handle other cases - convert to array if not already
              finalValue = Array.isArray(parsedLabel) ? parsedLabel : (parsedLabel && parsedLabel != "") ? [parsedLabel] : null;
            }

            await queryInterface.sequelize.query(
              `UPDATE bookings SET label_json = CAST(:parsedJson AS JSON) WHERE id = :id`,
              {
                replacements: { 
                  parsedJson: JSON.stringify(finalValue),
                  id: booking.id 
                },
                transaction: t
              }
            );
          } catch (error) {
            console.log(`Warning: Using raw value for booking ${booking.id}. Error was:`, error);
            await queryInterface.sequelize.query(
              `UPDATE bookings SET label_json = CAST(:rawValue AS JSON) WHERE id = :id`,
              {
                replacements: { 
                  rawValue: JSON.stringify([booking.label]),
                  id: booking.id 
                },
                transaction: t
              }
            );
          }
        }
      }

      await queryInterface.removeColumn('bookings', 'label', { transaction: t });

      await queryInterface.renameColumn('bookings', 'label_json', 'label', { transaction: t });
    });
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.addColumn('bookings', 'label_varchar', {
        type: Sequelize.STRING
      }, { transaction: t });

      const bookings = await queryInterface.sequelize.query(
        'SELECT id, label FROM bookings WHERE label IS NOT NULL',
        { transaction: t }
      );

      if (bookings[0].length > 0) {
        for (const booking of bookings[0]) {
          try {
            await queryInterface.sequelize.query(
              `UPDATE bookings SET label_varchar = :stringifiedJson WHERE id = :id`,
              {
                replacements: { 
                  stringifiedJson: JSON.stringify(booking.label),
                  id: booking.id 
                },
                transaction: t
              }
            );
          } catch (error) {
            console.log(`Warning: Using raw value for booking ${booking.id}. Error was:`, error);
            await queryInterface.sequelize.query(
              `UPDATE bookings SET label_varchar = :rawValue WHERE id = :id`,
              {
                replacements: { 
                  rawValue: String(booking.label),
                  id: booking.id 
                },
                transaction: t
              }
            );
          }
        }
      }

      await queryInterface.removeColumn('bookings', 'label', { transaction: t });

      await queryInterface.renameColumn('bookings', 'label_varchar', 'label', { transaction: t });
    });
  }
};