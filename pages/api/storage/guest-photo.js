import { Guest } from '../../../models';
import StorageService from "../../../services/storage/storage"
import formidable from "formidable";

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    const storage = new StorageService({ bucketType: 'restricted' });
    let guest;
    
    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields, files) => {
        if (err) {
            return res.status(500).json({ message: "Error parsing form" });
        }
        
        guest = await Guest.findOne({ where: { id: fields.guestId } });

        if (req.method === 'POST') {
            const filename = guest.id + '.' + files.file.originalFilename.split('.').pop();
            await storage.uploadFile(files.file.filepath, fields.fileType + '/' + filename);
            
            await guest.update({ profile_filename: filename });
            const url = await storage.getSignedUrl('guest-photo' + '/' + filename);

            return res.status(201).json({ message: "Successfully Uploaded", url });
        }

        else if (req.method === 'GET') {
            const url = await storage.getSignedUrl('guest-photo', guest.profile_filename);

            return res.status(200).json({ url: url });
        }

        else {
            return res.status(405).json({ message: "Method not allowed" });
        }
    });

}
