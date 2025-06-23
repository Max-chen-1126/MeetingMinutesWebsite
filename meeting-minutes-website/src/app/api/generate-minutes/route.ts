import { Storage } from '@google-cloud/storage';
import { GoogleAuth } from 'google-auth-library'; // Import GoogleAuth
import { NextRequest, NextResponse } from 'next/server';

// --- Initialize Google Cloud Clients ---

const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME;

const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform' // Scope for AI Platform
});

// --- Environment Variable Checks ---
if (!bucketName) {
    console.warn("Warning: GCS_BUCKET_NAME environment variable not set.");
}
if (!process.env.PROJECT_ID) {
    console.error("CRITICAL Error: PROJECT_ID environment variable not set.");
}
if (!process.env.LOCATION) {
    console.error("CRITICAL Error: LOCATION environment variable not set.");
}

// --- Helper function to parse GCS path ---
type ParsedGcsPath = { bucketName: string; filePath: string; } | null;
function parseGcsPath(gcsPath: unknown): ParsedGcsPath {
    if (typeof gcsPath !== 'string' || !gcsPath.startsWith('gs://')) return null;
    const pathWithoutPrefix = gcsPath.substring(5);
    const firstSlashIndex = pathWithoutPrefix.indexOf('/');
    if (firstSlashIndex === -1 || firstSlashIndex === pathWithoutPrefix.length - 1) return null;
    const bucket = pathWithoutPrefix.substring(0, firstSlashIndex);
    const file = pathWithoutPrefix.substring(firstSlashIndex + 1);
    if (!file) return null;
    if (bucketName && bucket !== bucketName) {
        console.warn(`Parsed bucket '${bucket}' does not match configured bucket '${bucketName}'`);
    }
    return { bucketName: bucket, filePath: file };
}

// --- API Handler Function ---
export async function POST(req: NextRequest) {
    const projectId = process.env.PROJECT_ID;
    const location = process.env.LOCATION;

    if (!projectId || !location) {
        return NextResponse.json({ error: "Server configuration error: Project ID or Location not set." }, { status: 500 });
    }

    let receivedGcsPath: string | null = null;
    // Removed unused 'errorOccurred' variable declaration
    let errorMessage = 'Failed to generate meeting record'; // Keep this as 'let' because it's reassigned in catch

    try {
        // --- Step 1: Get Request Body (JSON) ---
        const body = await req.json();
        receivedGcsPath = typeof body.gcsPath === 'string' ? body.gcsPath : null;
        const contentType = typeof body.contentType === 'string' ? body.contentType : 'audio/mpeg';
        const meetingName = body.meetingName || '未提供';
        const meetingDate = body.meetingDate || '未提供';
        const participants = body.participants || '未提供';
        const additionalInfo = body.additionalInfo || '無';

        // --- Input Validation ---
        if (!receivedGcsPath) {
            // Removed unused 'errorOccurred = true;'
            errorMessage = 'Missing required parameter: gcsPath';
            throw new Error(errorMessage);
        }
        const parsedPath = parseGcsPath(receivedGcsPath);
        if (!parsedPath) {
            // Removed unused 'errorOccurred = true;'
            errorMessage = 'Invalid GCS path format. Expected gs://bucket-name/file/path';
            throw new Error(errorMessage);
        }
        // NOTE: The ESLint error about unused 'filePath' might be specific to a scope
        // or an older version. 'parsedPath.filePath' is used in the 'finally' block.
        // If the build *still* complains about filePath being unused around line 82,
        // you might need to add:
        // // eslint-disable-next-line @typescript-eslint/no-unused-vars
        // above the line where ESLint reports the error, but first try without it.


        // --- Step 2: Get Access Token ---
        console.log("Getting access token...");
        const client = await auth.getClient();
        const accessToken = (await client.getAccessToken()).token;
        if (!accessToken) {
            throw new Error("Failed to obtain access token.");
        }
        console.log("Access token obtained.");

        // --- Step 3: Construct Prompt & REST API Request Body ---
        const textPrompt = `請根據以下資訊和提供的音檔生成一份詳細的會議記錄：
          會議名稱：${meetingName}
          會議時間：${meetingDate}
          參與人員：${participants}
          其他資訊：${additionalInfo}
          請根據音檔內容整理出會議的主要討論內容、決策事項和待辦事項。
          輸出格式請使用 Markdown。直接輸出會議記錄即可，使用三個點以及 Markdown 輸出會議記錄內容 :
        `;

        const requestPayload = {
            contents: [{
                role: "user",
                parts: [
                    {
                        fileData: {
                            mimeType: contentType,
                            fileUri: receivedGcsPath // Line 83 - Uses the full path string
                        }
                    },
                    {
                        text: textPrompt
                    }
                ]
            }],
            generationConfig: {
                "temperature": 0.1,
                // Increased maxOutputTokens - adjust based on Gemini model limits & needs
                "maxOutputTokens": 8192, // Was 50000, 8192 is common for many models
            }
        };

        // --- Step 4: Call Gemini REST API ---
        const modelId = "gemini-2.5-pro"; // Adjust if using a different model
        const apiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:generateContent`;

        console.log(`Calling Gemini REST API: ${apiUrl}`);
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify(requestPayload),
        });

        console.log(`API Response Status: ${apiResponse.status}`);
        if (!apiResponse.ok) {
            const errorBody = await apiResponse.text();
            console.error("Gemini API Error Response Body:", errorBody);
            let apiErrorMsg = `Gemini API Error: ${apiResponse.status} ${apiResponse.statusText}`;
            try {
                const errorJson = JSON.parse(errorBody);
                apiErrorMsg = errorJson.error?.message || apiErrorMsg;
            // Fixed: Removed unused 'parseErr' variable from catch signature
            } catch { /* Ignore if not JSON */ }
            throw new Error(apiErrorMsg);
        }

        const responseJson = await apiResponse.json();

        // --- Step 5: Process API Response ---
        const candidates = responseJson.candidates;
        if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
            console.error("Invalid response structure from Gemini API:", responseJson);
            throw new Error("Failed to parse response from Gemini API: No candidates found.");
        }

        const firstCandidate = candidates[0];
        const parts = firstCandidate?.content?.parts;
        if (!parts || !Array.isArray(parts) || parts.length === 0 || !parts[0].text) {
            console.error("Invalid response structure - parts or text missing:", responseJson);
            throw new Error("Failed to parse response from Gemini API: Text content missing.");
        }

        const generatedText = parts[0].text;
        console.log("Content generated successfully via REST API.");

        return NextResponse.json({ meetingRecord: generatedText ?? '' });

    } catch (error: unknown) {
        // Removed unused 'errorOccurred = true;'
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        } else {
            errorMessage = 'An unknown error occurred during processing';
        }
        console.error("Error during POST handler:", error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });

    } finally {
        // --- Step 6: Cleanup GCS File ---
        if (receivedGcsPath) {
            console.log(`Running final cleanup for GCS file: ${receivedGcsPath}...`);
            const parsedPath = parseGcsPath(receivedGcsPath);
            if (parsedPath && bucketName) {
                if (parsedPath.bucketName === bucketName) {
                    try {
                        await storage.bucket(parsedPath.bucketName).file(parsedPath.filePath).delete();
                        console.log(`Deleted GCS file post-processing: ${receivedGcsPath}`);
                    } catch (deleteError: unknown) {
                        console.error(`Error deleting GCS file ${receivedGcsPath} in finally:`, deleteError);
                        if (deleteError && typeof deleteError === 'object' && 'code' in deleteError && deleteError.code === 404) {
                            console.log("File was likely already deleted.");
                        }
                    }
                } else {
                    console.warn(`Skipping deletion: Parsed bucket '${parsedPath.bucketName}' doesn't match configured bucket '${bucketName}'.`);
                }
            } else {
                console.error(`Could not parse or verify GCS path for deletion in finally: ${receivedGcsPath}`);
            }
        }
    }
}