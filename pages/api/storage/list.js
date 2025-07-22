import StorageService from "../../../services/storage/storage";
import moment from "moment";
export default async function handler(req, res) {

    if(req.method === 'GET') {
        const {  filePath } = req.query;
        const storage = new StorageService({ bucketType: 'restricted' });
        const files = await storage.getFiles(filePath);
        const data = [];
        
        for (const file of files) {
            const [metadata] = await file.getMetadata();
            const fileName = file.name.split('/').pop();
            const downloadLink = await storage.getSignedUrl(file.name);
            data.push({
                date: moment(metadata.timeCreated).format('DD/MM/YYYY'),
                name: fileName,
                contentType: metadata.contentType,
                timeCreated: metadata.timeCreated,
                updated: metadata.updated,
                download_link: downloadLink,
                file_path: filePath,
            });
        }

        return res.status(200).send(data);
    }

    return res.status(405).send({ message: "Method Not Allowed" });

}