import { S3Client, PutBucketPolicyCommand } from '@aws-sdk/client-s3';

async function fixBucket() {
  const s3Client = new S3Client({
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
    const command = new PutBucketPolicyCommand({
      Bucket: bucketName,
      Policy: JSON.stringify(policy),
    });
    await s3Client.send(command);
    console.log(`✅ SUCCESS: Bucket '${bucketName}' is now fully Public! You can view all PDFs and Images S3 URLs freely!`);
  } catch (err) {
    console.error(`❌ FAILED: ${err}`);
  }
}

fixBucket();
