import { Setting } from '../../../../models';

export default function handler(req, res) {
    // Assuming you have imported the necessary modules and defined the Settings model

    if (req.method === 'POST') {
        const data = req.body;

        const smtpKeys = Object.keys(data);

        try {
            // Loop through the SMTP server details and update the database
            smtpKeys.map((key) => {
                switch (key) {
                    case 'smtp_host':
                        Setting.update({ value: data[key] }, { where: { attribute: 'MAIL_HOST' } });
                        break;
                    case 'smtp_port':
                        Setting.update({ value: data[key] }, { where: { attribute: 'MAIL_PORT' } });
                        break;
                    case 'smtp_username':
                        Setting.update({ value: data[key] }, { where: { attribute: 'MAIL_USER' } });
                        break;
                    case 'smtp_password':
                        Setting.update({ value: data[key] }, { where: { attribute: 'MAIL_PASSWORD' } });
                        break;
                    case 'smtp_sender_email':
                        Setting.update({ value: data[key] }, { where: { attribute: 'MAIL_SENDER_EMAIL' } });
                        break;
                }
            });

            // Handle successful save
            return res.status(200).json({ message: 'SMTP details saved successfully' });
        } catch (error) {
            console.log(error);
            // Handle save error
            return res.status(500).json({ error: 'Failed to save SMTP server details' });
        };
    }

    return res.status(404).json({ error: 'Invalid request method' });
}