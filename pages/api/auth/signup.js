const jwt = require("jsonwebtoken");
const { Sequelize, sequelize } = require("./../../../models");
import { getPasswordHash } from "../../../utilities/authentication";
import EmailService from "../../../services/booking/emailService";
import { TEMPLATE_IDS } from '../../../services/booking/templateIds';
import EmailTriggerService from "../../../services/booking/emailTriggerService";

const Guest = require("../../../models/guest");
const AccessToken = require("./../../../models/accesstoken");

async function handler(req, res) {
  const guestModel = Guest(sequelize, Sequelize.DataTypes);
  const accessTokenModel = AccessToken(sequelize, Sequelize.DataTypes);

  if (req.method === "POST") {

    const data = req.body;

    const user = await guestModel.findAll({
      where: {
        email: data.email,
      },
    });

    if (user.length > 0) {
      return res.status(409).json({ message: "User already exist." });
    }

    const hashedPassword = await getPasswordHash(data.password);

    const guest = await guestModel.create({ ...data, ...{ password: hashedPassword } });

    let token = jwt.sign({ email: guest.email, user_type: 'guest' }, process.env.SECRET);
    let confirmLink = process.env.APP_URL + `/auth/confirm-email/${token}`;

    const accessToken = await accessTokenModel.create({
      token: token,
      tokenable_id: guest.id,
      tokenable_type: "guest",
    });

    // Send email confirmation using EmailService
    let emailSent = false;
    try {
      // Fire signup triggers
      await signupTriggerDispatch(guest, confirmLink);
      // await EmailService.sendWithTemplate(
      //   guest.email,
      //   TEMPLATE_IDS.EMAIL_CONFIRMATION_LINK,
      //   {
      //     username: guest.first_name,
      //     confirmation_link: confirmLink
      //   }
      // );
      emailSent = true;
    } catch (emailError) {
      console.error('Error sending email confirmation:', emailError);
      // Don't fail the request if email fails
    }

    return res.status(200)
      .json({ users: guest, emailSent: emailSent, token: accessToken });

  } else {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
}

async function signupTriggerDispatch(guest, confirmLink) {
  // 🔔 Fire any configured system triggers for email_verification_requested
  try {
    await EmailTriggerService.evaluateAndSendTriggers(null, {
      email_verification_requested: true,
      account_created:    true,   // signup also creates the account
      guest_email:        guest.email,
      username:           guest.first_name,
      confirmation_link:  confirmLink,
    });
  } catch (triggerErr) {
    console.warn('⚠️ signup trigger dispatch failed (non-fatal):', triggerErr.message);
  }
}

export default handler;