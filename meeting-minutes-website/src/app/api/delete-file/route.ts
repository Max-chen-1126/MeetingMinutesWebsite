// src/app/api/delete-file/route.ts
import { Storage } from '@google-cloud/storage';
import { NextRequest, NextResponse } from 'next/server';

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
export async function POST(req: NextRequest): Promise<NextResponse<ErrorResponse>> { // Return type no longer includes SuccessResponse body
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
            // *** MODIFICATION 1: Return 204 on successful deletion ***
            // Instead of NextResponse.json({ message: 'File deleted successfully.' });
            return new NextResponse(null, { status: 204 }); // Return 204 No Content

        } catch (deleteError: unknown) {
            // Check if the error is specifically a "Not Found" error from GCS (code 404)
            if (deleteError && typeof deleteError === 'object' && 'code' in deleteError && deleteError.code === 404) {
                  console.log(`File not found during deletion attempt (404), treating as success (idempotent): gs://${bucketName}/${filePath}`);
                  // *** MODIFICATION 2: Return 204 when GCS file is not found ***
                  // Instead of NextResponse.json({ error: 'File not found.' }, { status: 404 });
                  return new NextResponse(null, { status: 204 }); // Return 204 No Content
            } else {
                 // For other unexpected errors during deletion
                 console.error(`GCS deletion failed for gs://${bucketName}/${filePath}:`, deleteError);
                 // Propagate a generic error for security, specific error logged above
                 // Let the outer catch handle sending the 500 response
                 throw new Error('Failed to delete file from storage.');
            }
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

        // Return 500 for any unhandled errors (like parsing errors or non-404 GCS errors)
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

// Optional: Add handlers for other methods if needed
// export async function GET(req: NextRequest) {
//   return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
// }