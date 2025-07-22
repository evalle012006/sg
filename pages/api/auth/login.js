import { verifyPassword } from "../../../utilities/authentication";
import { omitAttribute } from "../../../utilities/common";
import { getToken } from "next-auth/jwt"
import { Guest, User, ModelHasRole, RoleHasPermission } from "../../../models";


async function handler(req, res) {
  if (req.method === "POST") {

    const { email, password, type } = req.body;
    let user;

    const token = await getToken({ req });

    if (type === 'guest') {

      user = await Guest.findOne({
        where: {
          email: email,
        },
      });

    } else {
      user = await User.findOne({
        where: {
          email: email,
        },
        include: [{ model: ModelHasRole, as: 'roles', include: [{ model: RoleHasPermission, as: 'permissions' }] }]
      });
    }

    if (user == null || user.length === 0) {
      return res.status(409).json({ message: "Invalid Credentials" });
    }

    const verify = await verifyPassword(password, user.password);

    if (!verify) {
      return res.status(409).json({ message: "Invalid Credentials" });

    }

    return res
      .status(200)
      .json({ message: "Successfully login", user: { ...omitAttribute(user.dataValues, 'password', 'created_at', 'updated_at'), token: token } });


  } else {
    return res.status(405).json({ message: "Method Not Allowed" });

  }
}

export default handler;
