const jwt = require("jsonwebtoken");
const { Sequelize, sequelize, ModelHasRole, NotificationLibrary, Role } = require("../../../models");
import { getPasswordHash } from "../../../utilities/authentication";
import { NotificationService } from "../../../services/notification/notification";
import EmailService from "../../../services/booking/emailService";
import { TEMPLATE_IDS } from '../../../services/booking/templateIds';
import moment from "moment";

const User = require("../../../models/user");
const AccessToken = require("../../../models/accesstoken");

async function handler(req, res) {
  const userModel = User(sequelize, Sequelize.DataTypes);
  const accessTokenModel = AccessToken(sequelize, Sequelize.DataTypes);

  if (req.method === "POST") {
    const notificationLibs = await NotificationLibrary.findOne({ where: {name: 'User Created', enabled: true} });
    const notificationService = new NotificationService();

    const data = req.body;

    const userValidate = await userModel.findAll({
      where: {
        email: data.email,
      },
    });

    if (userValidate.length > 0) {
      return res.status(409).json({ message: "User already exist." });
    }

    let userData = { ...data };
    if (data.password) {
      const hashedPassword = await getPasswordHash(data.password);
      userData = { ...data, ...{ password: hashedPassword } };
    }

    const user = await userModel.create(userData);

    // FIX: Look up the role by name to get its ID
    if (data.role) {
      const role = await Role.findOne({ where: { name: data.role } });
      
      if (role) {
        await ModelHasRole.create({
          role_id: role.id, // Use role.id instead of data.role
          model_id: user.id,
          model_type: "user",
        });
      } else {
        // Handle case where role doesn't exist
        console.warn(`Role "${data.role}" not found`);
      }
    }

    let token = jwt.sign({ email: user.email, user_type: 'user' }, process.env.SECRET);
    let confirmLink = process.env.APP_URL + `/settings/users/${token}`;

    const accessToken = await accessTokenModel.create({
      token: token,
      tokenable_id: user.id,
      tokenable_type: "user",
    });

    // Send team email confirmation using EmailService
    let emailSent = false;
    try {
      await EmailService.sendWithTemplate(
        user.email,
        TEMPLATE_IDS.TEAM_EMAIL_CONFIRMATION_LINK,
        {
          username: user.first_name,
          confirmation_link: confirmLink
        }
      );
      emailSent = true;
    } catch (emailError) {
      console.error('Error sending team email confirmation:', emailError);
      // Don't fail the request if email fails
    }

    if (notificationLibs) {
      let message = notificationLibs.notification;
      message = message.replace('[user_email]', user.email);

      const dispatch_date = moment().add(notificationLibs.date_factor, 'days').toDate();
      await notificationService.notificationHandler({
          notification_to: notificationLibs.notification_to,
          message: message,
          link: null,
          dispatch_date: dispatch_date
      });
    }

    return res
      .status(200)
      .json({ user: user, emailSent: emailSent, token: accessToken });

  } else {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
}

export default handler;