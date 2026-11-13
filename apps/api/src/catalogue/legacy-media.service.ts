import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';

// Read-only compatibility: old originals are not moved or deleted automatically.
@Injectable()
export class LegacyMedia {
  async url(key: string | null) {
    if (!key || !process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY) {
      return null;
    }
    const client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
      },
    });
    return getSignedUrl(
      client,
      new GetObjectCommand({
        // Historical storage identifier; renaming the product must not move existing files.
        Bucket: process.env.S3_BUCKET || 'save',
        Key: key,
      }),
      { expiresIn: 900 },
    );
  }
}
