const nodemailer = require("nodemailer");

export function createTransportEmail() {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: process.env.EMAIL_SERVER_PORT,
    secure: true,
    auth: {
      secure: true,
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });

  return transporter;
}

export async function sendEmail(transporter, sendTo, content) {
  const result = await transporter.sendMail({
      from: process.env.EMAIL_SERVER_USER,
      to: sendTo,
      subject: "Message",
      html: content,
    });

    return result;
}
