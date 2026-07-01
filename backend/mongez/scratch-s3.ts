import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET || 'mongez-files';
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  console.log('Testing R2 connection with:');
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Bucket: ${bucket}`);
  console.log(`Access Key: ${accessKeyId ? '***' + accessKeyId.slice(-4) : 'undefined'}`);

  const client = new S3Client({
    endpoint,
    region: 'auto',
    credentials: {
      accessKeyId: accessKeyId || '',
      secretAccessKey: secretAccessKey || '',
    },
  });

  const testKey = 'test-r2-upload-' + Date.now() + '.txt';
  const buffer = Buffer.from('Hello from Mongez Cloudflare R2 test!');

  try {
    console.log('Uploading test file...');
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: testKey,
        Body: buffer,
        ContentType: 'text/plain',
      }),
    );
    console.log('Upload SUCCESSFUL!');

    console.log('Deleting test file...');
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: testKey,
      }),
    );
    console.log('Delete SUCCESSFUL!');
  } catch (err: any) {
    console.error('R2 Operation FAILED:');
    console.error(err);
  }
}

main();
