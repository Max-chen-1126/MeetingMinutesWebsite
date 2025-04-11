// meeting-minutes-website/src/app/api/generate-minutes/route.ts
import { GoogleGenAI, createPartFromUri, createUserContent } from "@google/genai";
import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import os from 'os';
import path from 'path';

// Move API_KEY check inside the POST function
const API_KEY = process.env.GOOGLE_API_KEY; // Define it here if needed elsewhere, but check inside POST

const ai = process.env.GOOGLE_API_KEY ? new GoogleGenAI({
    apiKey: API_KEY}) : null; // Initialize conditionally or check inside POST

async function writeTempFile(buffer: Buffer, fileName: string): Promise<string> {
    // ... (keep helper function)
    const tempDir = path.join(os.tmpdir(), 'meeting-minutes-uploads');
    await fs.mkdir(tempDir, { recursive: true });
    const tempFilePath = path.join(tempDir, `${Date.now()}-${fileName}`);
    await fs.writeFile(tempFilePath, buffer);
    console.log(`Temporary file created at: ${tempFilePath}`);
    return tempFilePath;
}

async function deleteTempFile(filePath: string) {
    // ... (keep helper function)
     try {
        await fs.unlink(filePath);
        console.log(`Temporary file deleted: ${filePath}`);
    } catch (err) {
        // Log cleanup errors but don't let them crash the main flow
        console.error(`Error deleting temporary file ${filePath}:`, err);
    }
}

export async function POST(req: NextRequest) {
    // --- Check API Key FIRST ---
    const API_KEY = process.env.GOOGLE_API_KEY;
    if (!API_KEY || !ai) { // Check if API_KEY exists and ai was initialized
        console.error("FATAL: GOOGLE_API_KEY is not defined or GenAI client failed to initialize.");
        return NextResponse.json({ error: "Server configuration error: API Key missing or invalid." }, { status: 500 });
    }
    // --- End API Key Check ---

    let tempFilePath: string | null = null;
    let uploadedFileName: string | null = null;
    let errorOccurred = false;
    let errorMessage = 'Failed to generate meeting record'; // Default error message
    let responseData: any = null; // To store success data

    try {
        // ... (rest of the try block remains the same)
        const formData = await req.formData();
        const audioFile = formData.get('audioFile') as File | null;
        
        if (!audioFile) {
            errorOccurred = true;
            errorMessage = 'No audio file provided';
             throw new Error(errorMessage); 
        }

        console.log("Saving file temporarily...");
        const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
        tempFilePath = await writeTempFile(audioBuffer, audioFile.name);

        console.log("Uploading file via @google/genai...");
        const mimeType = audioFile.type || "audio/mpeg";
        const uploadResult = await ai.files.upload({
            file: tempFilePath,
            config: { mimeType: mimeType },
        });
        uploadedFileName = uploadResult.name ?? null;

        if (!uploadResult.uri || !uploadedFileName) {
             errorOccurred = true;
             errorMessage = "File upload failed: URI or Name not received.";
             console.error(errorMessage, uploadResult);
             if(uploadedFileName) await ai.files.delete({ name: uploadedFileName });
             throw new Error(errorMessage);
        }
        console.log(`Uploaded file: ${uploadResult.displayName} as ${uploadResult.uri}, Name: ${uploadedFileName}`);

        await deleteTempFile(tempFilePath);
        tempFilePath = null; 

        const textPrompt = `請根據以下資訊和提供的音檔生成一份詳細的會議記錄：
          會議名稱：${formData.get('meetingName') || '未提供'}
          會議時間：${formData.get('meetingDate') || '未提供'}
          參與人員：${formData.get('participants') || '未提供'}
          其他資訊：${formData.get('additionalInfo') || '無'}
          請根據音檔內容整理出會議的主要討論內容、決策事項和待辦事項。
          輸出格式請使用 Markdown。直接輸出會議記錄即可，使用三個點以及 Markdown 輸出會議記錄內容 : 
        `;
        const audioFilePart = createPartFromUri(uploadResult.uri, mimeType);
        const content = createUserContent([audioFilePart, textPrompt]);

        console.log("Generating content...");
        const generationResult = await ai.models.generateContent({
            model: "gemini-2.5-pro-preview-03-25",
            contents: content,
            config: {
                maxOutputTokens: 65536,
                temperature: 0.1,
              },
        });
        const generatedText = generationResult.text;
        console.log("Content generated.");
        responseData = { meetingRecord: generatedText };

    } catch (error: any) {
        errorOccurred = true;
        errorMessage = error.message || 'An unknown error occurred during processing';
        console.error("Error during POST handler:", error);

    } finally {
        // ... (finally block remains the same)
         if (tempFilePath) {
            console.log("Running final cleanup for temporary file...");
            await deleteTempFile(tempFilePath);
        }
        if (uploadedFileName && !responseData) { 
             try {
                console.log(`Ensuring deletion of uploaded file due to error or incomplete process: ${uploadedFileName}...`);
                await ai.files.delete({ name: uploadedFileName });
                console.log(`Cleaned up uploaded file: ${uploadedFileName}`);
            } catch (deleteError) {
                console.error(`Error cleaning up uploaded file ${uploadedFileName} in finally:`, deleteError);
            }
        } else if (responseData && uploadedFileName) {
            try {
                console.log(`Deleting uploaded file after successful generation: ${uploadedFileName}...`);
                await ai.files.delete({ name: uploadedFileName });
                console.log(`Deleted uploaded file post-success: ${uploadedFileName}`);
            } catch (deleteError) {
                 console.error(`Non-critical error deleting uploaded file ${uploadedFileName} after success:`, deleteError);
            }
        }

        if (errorOccurred || !responseData) {
             console.log(`Sending error response: ${errorMessage}`);
             return NextResponse.json({ error: errorMessage }, { status: 500 });
        } else {
             console.log("Sending success response.");
             return NextResponse.json(responseData);
        }
    }
}