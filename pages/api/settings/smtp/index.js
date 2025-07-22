// Import the necessary modules
import { Setting } from "../../../../models";
import { Op } from "sequelize";

// Define the API endpoint
export default async function handler(req, res) {
    try {
        // Get the SMTP settings from the database
        const smtpSettings = await Setting.findAll({
            where: {
                attribute: {
                    [Op.in]: ['MAIL_HOST', 'MAIL_PORT', 'MAIL_USER', 'MAIL_PASSWORD', 'MAIL_SENDER_EMAIL']
                }
            },
        });

        let data = {};

        // Loop through the SMTP settings and add them to the data object
        smtpSettings.map((setting) => {
            switch (setting.attribute) {
                case 'MAIL_HOST':
                    data.smtp_host = setting.value;
                    break;
                case 'MAIL_PORT':
                    data.smtp_port= setting.value;
                    break;
                case 'MAIL_USER':
                    data.smtp_username = setting.value;
                    break;
                case 'MAIL_PASSWORD':
                    data.smtp_password= setting.value;
                    break;
                case 'MAIL_SENDER_EMAIL':
                    data.smtp_sender_email = setting.value;
                    break;
            }
        });

        // Return the SMTP settings as the response
        return res.status(200).json(data);
    } catch (error) {
        // Handle any errors that occur
        console.error('Error retrieving SMTP settings:', error);
        return res.status(500).json({ error: 'Failed to retrieve SMTP settings' });
    }
}
