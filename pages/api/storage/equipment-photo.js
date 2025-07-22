import { Equipment, Guest, User } from '../../../models';
import StorageService from "../../../services/storage/storage"
import formidable from "formidable";

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    const storage = new StorageService({ bucketType: 'restricted' });
    let equipment;

    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields, files) => {
        if (err) {
            return res.status(500).json({ message: "Error parsing form" });
        }

        equipment = await Equipment.findOne({ where: { id: fields.equipmentId } });

        if (req.method === 'POST') {

            const filename = equipment.id + '.' + files.file.originalFilename.split('.').pop();
            try {
                await storage.uploadFile(files.file.filepath, fields.fileType + '/' + filename);
            } catch {
                return res.status(500).json({ message: "Error uploading file" });
            }

            const resp = await equipment.update({ image_filename: filename });
            if (resp) {
                const url = await storage.getSignedUrl('equipment-photo' + '/' + filename);

                return res.status(201).json({ message: "Successfully Uploaded", url, filename });
            }
        }

        else if (req.method === 'GET') {
            const url = await storage.getSignedUrl('equipment-photo', equipment.image_filename);

            return res.status(200).json({ url: url });
        }

        else {
            return res.status(405).json({ message: "Method not allowed" });
        }
    });

}
