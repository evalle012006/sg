import { RoomType } from '../../../models';
import StorageService from "../../../services/storage/storage"
import formidable from "formidable";
import { v4 as uuidv4 } from 'uuid';
export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {

    const { id } = req.query;
    const storage = new StorageService({ bucketType: 'restricted' });
    let roomType = await RoomType.findOne({ where: { id } });


    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields, files) => {
        if (err) {
            return res.status(500).send({ message: "Error parsing form" });
        }

        if (req.method === 'POST') {
            const filename = roomType.name.replace(/ /g, "-").toLowerCase() + '.' + files.file.originalFilename.split('.').pop();

            await storage.uploadFile(files.file.filepath, fields.fileType + "/" + filename);

            await roomType.update({ image_filename: filename });

            const imageUrl = await storage.getSignedUrl(fields.fileType + "/" + filename);

            return res.status(201).send({ message: "Successfully Uploaded", imageUrl });
        } else if (req.method === 'GET') {
            const imageUrl = await storage.getSignedUrl(fields.fileType + "/" + filename);

            return res.status(200).send({ image_url: imageUrl });
        }

        else {
            return res.status(405).send({ message: "Method not allowed" });
        }
    });

}
