"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_s3_1 = require("@aws-sdk/client-s3");
async function fixBucket() {
    const s3Client = new client_s3_1.S3Client({
        endpoint: 'http://localhost:9000',
        region: 'ap-south-1',
        credentials: {
            accessKeyId: 'minioadmin',
            secretAccessKey: 'minioadmin',
        },
        forcePathStyle: true,
    });
    const bucketName = 'demat-documents';
    const policy = {
        Version: '2012-10-17',
        Statement: [
            {
                Effect: 'Allow',
                Principal: '*',
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${bucketName}/*`],
            },
        ],
    };
    try {
        const command = new client_s3_1.PutBucketPolicyCommand({
            Bucket: bucketName,
            Policy: JSON.stringify(policy),
        });
        await s3Client.send(command);
        console.log(`✅ SUCCESS: Bucket '${bucketName}' is now fully Public! You can view all PDFs and Images S3 URLs freely!`);
    }
    catch (err) {
        console.error(`❌ FAILED: ${err}`);
    }
}
fixBucket();
//# sourceMappingURL=fix-bucket.js.map