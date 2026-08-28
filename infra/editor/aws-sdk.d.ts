/**
 * Just enough of the AWS SDK v3 surface handler.ts touches. The real
 * packages are provided by the Lambda nodejs22.x runtime and are externals
 * of the bundle, so they are not installed here; these declarations let
 * `tsc -p tsconfig.editor.json` check the wiring without them.
 */

declare module "@aws-sdk/client-s3" {
  export class S3Client {
    constructor(config: Record<string, unknown>);
    send(command: PutObjectCommand): Promise<unknown>;
  }
  export class PutObjectCommand {
    constructor(input: { Bucket: string; Key: string; Body: string; ContentType?: string; CacheControl?: string });
  }
}

declare module "@aws-sdk/client-cloudfront" {
  export class CloudFrontClient {
    constructor(config: Record<string, unknown>);
    send(command: CreateInvalidationCommand): Promise<unknown>;
  }
  export class CreateInvalidationCommand {
    constructor(input: {
      DistributionId: string;
      InvalidationBatch: { CallerReference: string; Paths: { Quantity: number; Items: string[] } };
    });
  }
}
