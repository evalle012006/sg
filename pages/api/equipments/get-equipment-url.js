import StorageService from "../../../services/storage/storage";

export default async function handler(req, res) {
    const storage = new StorageService({ bucketType: 'restricted' });
    const { image_filename } = req.query;

    const url = await storage.getSignedUrl('equipment-photo' + '/' + image_filename);

    return res.status(200).json({ url: url });
}
