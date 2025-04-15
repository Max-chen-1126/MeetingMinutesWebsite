// src/app/api/generate-upload-url/route.ts
import { GetSignedUrlConfig, Storage } from '@google-cloud/storage';
import { NextRequest, NextResponse } from 'next/server'; // Import from next/server

// Keep the type definitions
type GenerateUploadUrlResponse = {
    signedUrl: string;
    gcsPath: string;
};

type ErrorResponse = {
    error: string;
};

interface RequestBody {
    filename?: unknown;
    contentType?: unknown;
}

const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME;

if (!bucketName) {
    console.error("CRITICAL Error: GCS_BUCKET_NAME environment variable not set at initialization.");
    // Consider throwing an error here during build/startup if critical
}

// Use named export POST for the App Router
export async function POST(req: NextRequest): Promise<NextResponse<GenerateUploadUrlResponse | ErrorResponse>> {
    if (!bucketName) {
        console.error("Error in handler: GCS_BUCKET_NAME environment variable not set.");
        // Use NextResponse for App Router responses
        return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }

    // No need to check req.method, framework handles routing to POST

    try {
        // Parse body using await req.json() for App Router
        const body = await req.json() as RequestBody;
        const { filename, contentType } = body;

        if (typeof filename !== 'string' || filename.trim() === '') {
            return NextResponse.json({ error: 'Missing or invalid parameter: filename (must be a non-empty string)' }, { status: 400 });
        }
        if (typeof contentType !== 'string' || contentType.trim() === '') {
            return NextResponse.json({ error: 'Missing or invalid parameter: contentType (must be a non-empty string)' }, { status: 400 });
        }

        // Rest of the logic remains similar
        const uniqueFilename = `${Date.now()}-${filename.replace(/\s+/g, '_')}`;
        const filePath = `uploads/${uniqueFilename}`;

        const options: GetSignedUrlConfig = {
            version: 'v4',
            action: 'write',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
            contentType: contentType,
        };

        console.log(`Generating v4 signed URL for: ${filePath} with contentType: ${contentType}`);

        const [signedUrl] = await storage
            .bucket(bucketName)
            .file(filePath)
            .getSignedUrl(options);

        const gcsPath: string = `gs://${bucketName}/${filePath}`;
        console.log(`Generated Signed URL for ${gcsPath}`);

        // Use NextResponse for App Router responses
        return NextResponse.json({ signedUrl, gcsPath }); // Status 200 is default

    } catch (error: unknown) {
        console.error('Error generating signed URL:', error);
        const errorMessage = 'Internal server error while generating upload URL.';
        if (error instanceof Error) {
            console.error("Error details:", error.message);
            // Potentially use error.message if it's safe to expose
        }
        // Use NextResponse for App Router responses
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

// Optional: Add a handler for other methods if needed, or let Next.js return 405
// export async function GET(req: NextRequest) {
//   return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
// }