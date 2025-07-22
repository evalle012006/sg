import { Guest, User } from '../../../models';
import StorageService from "./../../../services/storage/storage"
import formidable from "formidable";

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {

    const { email, userType } = req.query;
    const storage = new StorageService({ bucketType: 'restricted' });
    let user;
    let filename;

    const generateRandomNumber = () => {
        return Math.floor(1000 + Math.random() * 9000);
    }

    if (userType == 'user') {
        user = await User.findOne({ where: { email } });
    } else {
        user = await Guest.findOne({ where: { email } });
    }

    if (req.method === 'POST') {

        const form = new formidable.IncomingForm();

        const promise = new Promise((resolve, reject) => {
            form.parse(req, async (err, fields, files) => {
                filename = user.uuid + generateRandomNumber() + '.' + files.file.originalFilename.split('.').pop();

                if (err) {
                    return res.status(500).json({ message: "Error parsing form" });
                    reject(err);
                }

                try {
                    storage.uploadFile(files.file.filepath, fields.fileType + '/' + filename);
                } catch (error) {
                    return res.status(500).json({ message: "Error uploading file" });
                    reject(error);
                }

                return resolve({ fields, files });
            });
        });

        await promise.then(async (result) => {
            const profileUrl = await storage.getSignedUrl('profile-photo/' + filename);
            if (userType == 'user') {
                await User.update({ profile_filename: filename }, { where: { email } });
            } else {
                await Guest.update({ profile_filename: filename }, { where: { email } });
            }
            return res.status(201).json({ message: "Successfully Uploaded", profileUrl });
        }).catch((error) => {
            return res.status(500).json({ message: "Sorry, something went wrong. Please try again.", error });
        });
    }

    if (req.method === 'GET') {

        if (user) {
            const profileUrl = await storage.getSignedUrl('profile-photo' + '/' + user.profile_filename);
            return res.status(200).json({ profile_url: profileUrl });
        } else {
            return res.status(404).json({ message: "User not found" });
        }
    }

    return res.status(405).json({ message: "Method not allowed" });
}
