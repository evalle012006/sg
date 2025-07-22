import StorageService from "../../../services/storage/storage";

async function handler(req, res) {
    if (req.method !== 'PUT') {
        return res.status(405).send({ message: "Method Not Allowed" });
    }

    const storage = new StorageService({ bucketType: "restricted" });
    const { oldFilename, newFilename, filepath } = req.body;

    if (!oldFilename || !newFilename || !filepath) {
        return res.status(400).send({ message: "Missing required parameters" });
    }

    try {
        const oldFile = storage.bucket.file(filepath + oldFilename);
        const newFile = storage.bucket.file(filepath + newFilename);

        const [exists] = await oldFile.exists();
        if (!exists) {
            return res.status(404).send({ message: "Original file not found" });
        }

        const [newExists] = await newFile.exists();
        if (newExists) {
            return res.status(409).send({ message: "A file with this name already exists" });
        }

        await oldFile.copy(newFile);

        await oldFile.delete();

        const newFileUrl = await storage.getSignedUrl(filepath + newFilename);

        return res.status(200).send({
            message: "File renamed successfully",
            fileUrl: newFileUrl
        });

    } catch (error) {
        console.error("Error renaming file:", error);
        return res.status(500).send({ 
            message: "Error renaming file",
            error: error.message 
        });
    }
}

export default handler;