const { Guest } = require("../../../../models");

async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const { uuid } = req.query;
      const { email_verified } = req.body;

      if (!uuid) {
        return res.status(400).json({ message: "Guest UUID is required" });
      }

      if (typeof email_verified !== 'boolean') {
        return res.status(400).json({ message: "email_verified must be a boolean value" });
      }

      // Find the guest
      const guest = await Guest.findOne({ where: { uuid } });

      if (!guest) {
        return res.status(404).json({ message: "Guest not found" });
      }

      // Update email verification status
      await guest.update({ email_verified });

      return res.status(200).json({ 
        message: "Email verification status updated successfully",
        guest: {
          uuid: guest.uuid,
          email_verified: guest.email_verified
        }
      });

    } catch (error) {
      console.error('Error updating email verification:', error);
      return res.status(500).json({ 
        message: "Error updating email verification status", 
        error: error.message 
      });
    }

  } else {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
}

export default handler;