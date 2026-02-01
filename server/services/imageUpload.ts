import { Client } from "@notionhq/client";
import { NOTION_VERSION } from "./notionClient.js";

export async function fetchImageAsBuffer(imageUrl: string) {
    console.log("[UPLOAD] Fetching image:", imageUrl);
    const resp = await fetch(imageUrl);
    if (!resp.ok) {
        throw new Error(`Failed to fetch image: ${resp.status} ${resp.statusText}`);
    }
    const contentType = resp.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const urlPath = new URL(imageUrl).pathname;
    const baseName = urlPath.split("/").pop() || "image";
    const extFromType = contentType.split("/")[1] || "jpg";
    const fileName = baseName.includes(".") ? baseName : `${baseName}.${extFromType}`;

    console.log("[UPLOAD] Fetched:", { fileName, contentType, size: buffer.length });
    return { buffer, contentType, fileName };
}

export async function uploadImageToNotion(imageUrl: string, notion: Client, accessToken: string) {
    const { buffer, contentType, fileName } = await fetchImageAsBuffer(imageUrl);

    console.log("[UPLOAD] Creating file upload:", { fileName, contentType, size: buffer.length });
    const createUpload: any = await notion.request({
        method: "post",
        path: "file_uploads",
        body: {
            file_name: fileName,
            content_type: contentType,
            file_size: buffer.length,
        },
    });

    const uploadUrl = createUpload.upload_url;
    const uploadId = createUpload.id;

    console.log("[UPLOAD] Create response:", {
        id: uploadId,
        has_upload_url: !!uploadUrl,
        full_response: JSON.stringify(createUpload, null, 2)
    });

    if (!uploadUrl || !uploadId) {
        throw new Error("Notion file upload did not return upload_url or id");
    }

    console.log("[UPLOAD] Uploading bytes to:", uploadUrl);

    // Use multipart/form-data with 'file' field
    const blob = new Blob([buffer], { type: contentType });
    const formData = new FormData();
    formData.append('file', blob, fileName);
    console.log("[UPLOAD] FormData created with file:", fileName, "size:", buffer.length);

    const uploadResp = await fetch(uploadUrl, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Notion-Version": NOTION_VERSION,
        },
        body: formData,
    });

    console.log("[UPLOAD] POST response:", uploadResp.status, uploadResp.statusText);

    if (!uploadResp.ok) {
        const errorBody = await uploadResp.text();
        console.error("[UPLOAD] POST error body:", errorBody);
        throw new Error(`Upload failed: ${uploadResp.status} ${uploadResp.statusText} - ${errorBody}`);
    }

    // Parse /send response to check status
    const sendResponse = await uploadResp.json();
    const isAlreadyUploaded = sendResponse?.status === "uploaded";

    // For simple uploads (≤20 MiB), /send auto-completes - skip /complete
    if (isAlreadyUploaded) {
        return { uploadId, type: "file_upload" };
    }

    // For multi-part uploads, call /complete
    console.log("[UPLOAD] Completing upload:", uploadId);
    const completed: any = await notion.request({
        method: "post",
        path: `file_uploads/${uploadId}/complete`,
    });

    console.log("[UPLOAD] Complete response:", {
        has_file: !!completed?.file,
        file_url: completed?.file?.url,
        expiry_time: completed?.file?.expiry_time,
    });

    return { uploadId, type: "file_upload" };
}
