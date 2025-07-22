import StorageService from "../../../services/storage/storage";
import formidable from "formidable";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function handler(req, res) {
  const storage = new StorageService({ bucketType: "restricted" });

  if (req.method === "POST") {
    const form = new formidable.IncomingForm({ 
      keepExtensions: true,
      maxFileSize: 1024 * 1024 * 1024 
    });

    const promise = new Promise((resolve, reject) => {
      form.parse(req, async (err, fields, files) => {
        if (err) {
          console.log("Error parsing form: ", err);
          reject(err);
          return;
        }

        try {
          const file = files.file;
          const destination = fields.fileType + file.originalFilename;
          
          await storage.bucket.upload(
            file.filepath,
            { 
              destination: destination,
              metadata: { metadata: fields.metadata }
            }
          );

          const fileUrl = await storage.getSignedUrl(destination);
          resolve({ fileUrl, message: "File uploaded successfully" });
        } catch (error) {
          reject(error);
        }
      });
    });

    try {
      const result = await promise;
      return res.status(200).json(result);
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({ 
        message: "Sorry, something went wrong. Please try again.",
        error: error.message 
      });
    }
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}

export default handler;