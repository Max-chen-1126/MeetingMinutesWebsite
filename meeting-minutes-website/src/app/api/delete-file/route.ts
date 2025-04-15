// src/app/api/delete-file/route.ts
import { Storage } from '@google-cloud/storage';
import { NextRequest, NextResponse } from 'next/server'; // Import from next/server

// Keep type definitions
type SuccessResponse = {
    message: string;
};
type ErrorResponse = {
    error: string;
};
interface RequestBody {
    gcsPath?: unknown;
}
type ParsedGcsPath = {
    bucketName: string;
    filePath: string;
} | null;

const storage = new Storage();
const expectedBucketName = process.env.GCS_BUCKET_NAME;

if (!expectedBucketName) {
    console.warn("Warning: GCS_BUCKET_NAME environment variable not set. Bucket name security check in delete API will be skipped.");
}

// Keep helper function
function parseGcsPath(gcsPath: unknown): ParsedGcsPath {
    if (typeof gcsPath !== 'string' || !gcsPath.startsWith('gs://')) {
        return null;
    }
    const pathWithoutPrefix = gcsPath.substring(5);
    const firstSlashIndex = pathWithoutPrefix.indexOf('/');
    if (firstSlashIndex === -1 || firstSlashIndex === pathWithoutPrefix.length - 1) {
        return null;
    }
    const bucketName = pathWithoutPrefix.substring(0, firstSlashIndex);
    const filePath = pathWithoutPrefix.substring(firstSlashIndex + 1);
    if (!filePath) {
         return null;
    }
    return { bucketName, filePath };
}


// Use named export POST for the App Router
export async function POST(req: NextRequest): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
    // No need to check req.method

    try {
        // Parse body using await req.json() for App Router
        const body = await req.json() as RequestBody;
        const { gcsPath } = body;

        if (typeof gcsPath !== 'string' || gcsPath.trim() === '') {
            return NextResponse.json({ error: 'Missing or invalid parameter: gcsPath (must be a non-empty string)' }, { status: 400 });
        }

        // --- Parse and Validate GCS Path ---
        const parsedPath: ParsedGcsPath = parseGcsPath(gcsPath);

        if (!parsedPath) {
            // Corrected the error message format
            return NextResponse.json({ error: 'Invalid GCS path format. Expected gs://bucket-name/file/path' }, { status: 400 });
        }

        const { bucketName, filePath } = parsedPath;

        // Bucket name check logic remains the same
        if (expectedBucketName && bucketName !== expectedBucketName) {
            console.warn(`Attempted deletion from unexpected bucket: ${bucketName}. Expected: ${expectedBucketName}. GCS Path: ${gcsPath}`);
            return NextResponse.json({ error: 'Forbidden: Cannot delete from the specified bucket.' }, { status: 403 });
        } else if (!expectedBucketName) {
             console.warn(`Skipping bucket name check for deletion as GCS_BUCKET_NAME is not set. Path: ${gcsPath}`);
        }

        console.log(`Attempting to delete GCS file: gs://${bucketName}/${filePath}`);

        try {
            await storage.bucket(bucketName).file(filePath).delete();
            console.log(`Successfully deleted GCS file: gs://${bucketName}/${filePath}`);
            return NextResponse.json({ message: 'File deleted successfully.' }); // Status 200 default

        } catch (deleteError: unknown) {
            let isNotFoundError = false;
            if (deleteError && typeof deleteError === 'object' && 'code' in deleteError) {
                 if (deleteError.code === 404) {
                      isNotFoundError = true;
                      console.log(`File not found during deletion attempt (404): gs://${bucketName}/${filePath}`);
                      return NextResponse.json({ error: 'File not found.' }, { status: 404 });
                 }
            }

            if (!isNotFoundError) {
                 console.error(`GCS deletion failed for gs://${bucketName}/${filePath}:`, deleteError);
                 // Propagate a generic error for security, specific error logged above
                 throw new Error('Failed to delete file from storage.');
            }
            // Should not reach here if isNotFoundError is true due to the return above
            return NextResponse.json({ error: 'An unexpected error occurred during deletion logic.' }, { status: 500 });
        }

    } catch (error: unknown) {
        console.error('Error processing delete request:', error);
        let errorMessage = 'Internal server error while deleting file.';
        // Refine error message extraction if needed
        if (error instanceof Error) {
             errorMessage = error.message; // Use the specific error message if available
             console.error("Detailed error:", error.message, error.stack);
        } else {
             console.error("Unknown error object:", error);
        }

        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

// Optional: Add handlers for other methods if needed
// export async function GET(req: NextRequest) {
//   return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
// }