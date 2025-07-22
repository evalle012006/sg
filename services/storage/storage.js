// Imports the Google Cloud client library
const { Storage } = require('@google-cloud/storage');

// For more information on ways to initialize Storage, please see
// https://googleapis.dev/nodejs/storage/latest/Storage.html

export default class StorageService {
    constructor({ bucketType = 'restricted' }) {
        const project_id = process.env.STORAGE_PROJECT_ID;
        const bucket_name = process.env.STORAGE_BUCKET_NAME;
        const restricted_bucket_name = process.env.STORAGE_RESTRICTED_BUCKET_NAME;
        const key_filename = process.env.STORAGE_KEY_FILE;
        // Creates a client using Application Default Credentials

        this.storage = new Storage({ projectId: project_id, keyFilename: key_filename });
        this.bucket = this.storage.bucket(bucketType == 'public' ? bucket_name : restricted_bucket_name);
    }

    async uploadFile(filepath, destination, metadata = null) {
        new Promise((resolve, reject) => {
            this.bucket.upload(filepath, {
                destination: destination,
                metadata: {
                    metadata: metadata,
                },
            }, (response) => {
                if (response != null) {
                    return reject(response);
                }
                return resolve(response);
            });
        }).then(() => {
            return true;
        }).catch((error) => {
            console.error("Error uploading file: ", error);
            return false;
        });
    }

    async deleteFile(filepath, filename) {
        await this.bucket.file(filepath + filename).delete();
    }

    async getFiles(prefix) {
        const [files] = await this.bucket.getFiles({ prefix: prefix });
        return files;
    }

    async getFile(filepath, filename) {
        const file = this.bucket.file(filepath + filename);
        return file;
    }

    async getSignedUrl(filepath) {
        const file = this.bucket.file(filepath);
        return await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        }).then((data) => data[0]).catch(console.error);
    }

    async getFileUrl(filepath, filename) {
        const file = this.bucket.file(filepath + '/' + filename);
        const [url] = await file.publicUrl();
        return url;
    }

    async fileExists(filepath) {
        const file = this.bucket.file(filepath);
        return file.exists().then((data) => data[0]);
    }

}