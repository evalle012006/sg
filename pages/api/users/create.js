const jwt = require("jsonwebtoken");
const { Sequelize, sequelize, ModelHasRole, NotificationLibrary } = require("../../../models");
import sendMail from "../../../utilities/mail";
import { getPasswordHash } from "../../../utilities/authentication";
import { NotificationService } from "../../../services/notification/notification";
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

    if (data.role) {
      await ModelHasRole.create({
        role_id: data.role,
        model_id: user.id,
        model_type: "user",
      });
    }

    let token = jwt.sign({ email: user.email, user_type: 'user' }, process.env.SECRET);
    let confirmLink = process.env.APP_URL + `/settings/users/${token}`;

    const accessToken = await accessTokenModel.create({
      token: token,
      tokenable_id: user.id,
      tokenable_type: "user",
    });

    const sentEmail = await sendMail(
      user.email,
      "Sargood - Email Confirmation",
      "team-email-confirmation-link",
      { username: user.first_name, confirm_link: confirmLink }
    );

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
      .json({ users: user, emailSent: sentEmail, token: accessToken });

  } else {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
}

export default handler;
