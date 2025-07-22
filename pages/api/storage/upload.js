import StorageService from "../../../services/storage/storage";
import formidable from "formidable";

export const config = {
    api: {
        bodyParser: false,
    },
};

async function handler(req, res) {
    const storage = new StorageService({ bucketType: "restricted" });
    if (req.method == "POST") {
        const form = new formidable.IncomingForm({ keepExtensions: true, multiples: true, maxFileSize: 1024 * 1024 * 1024 });

        const promise = new Promise((resolve, reject) => {
            form.parse(req, async (err, fields, files) => {
                if (err) {
                    console.log("Error parsing form: ", err)
                    reject(err);
                }
                storage.bucket.upload(files.file.filepath,
                    { destination: fields.fileType + files.file.originalFilename, metadata: { metadata: fields.metadata } },
                    (response) => {                        
                        if (response != null) {
                            return reject(response);
                        }

                        return resolve({ message: "File uploaded successfully", fields, files });
                    });
                });
            });
            
            return promise.then(async(result) => {
            const fileUrl = await storage.getSignedUrl(result.fields.fileType + result.files.file.originalFilename);
            return res.status(200).send({ fileUrl, message: "File uploaded successfully" });
        }).catch((error) => {
            return res.status(500).send({ message: "Sorry, something went wrong. Please try again.", error });
        });
    }

    if (req.method === "GET") {
        const { filename, filepath } = req.query;
        try {
            const fileUrl = await storage.getSignedUrl(filepath + filename);
            return res.status(200).send({ fileUrl });
        } catch (error) {
            console.error("Error retrieving file URL:", error);
            return res.status(500).send({ message: "Error retrieving file URL" });
        }
    }

    if (req.method === "DELETE") {
        const { filename, filepath } = req.query;
        try {
            await storage.deleteFile(filepath, filename);
            
            return res.status(200).send();
        } catch (error) {
            
            if(error.code == 404){
                return res.status(404).send({ message: "File not found" });
            }

            console.error("Error deleting file:", error);
            return res.status(500).send({ message: "Error deleting file" });
        }
    }

    return res.status(405).send({ message: "Method Not Allowed" });
}

export default handler;
