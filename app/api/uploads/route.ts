import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { s3, BUCKET } from "@/lib/storage";

const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

// File extension -> the content type we'll store it with
const ALLOWED_TYPES: Record<string, string> = {
  wav: "audio/wav",
  aif: "audio/aiff",
  aiff: "audio/aiff",
  flac: "audio/flac",
};

export async function POST(request: Request) {
  // 1. Must be signed in
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json(
      { error: "You need to sign in to upload." },
      { status: 401 }
    );
  }

  // 2. Read and check the request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { filename, size } = (body ?? {}) as {
    filename?: unknown;
    size?: unknown;
  };

  if (
    typeof filename !== "string" ||
    !filename.includes(".") ||
    typeof size !== "number" ||
    !Number.isInteger(size) ||
    size <= 0
  ) {
    return Response.json(
      { error: "Missing or invalid filename or size." },
      { status: 400 }
    );
  }

  // 3. Validate file type (by extension) and size
  const dotIndex = filename.lastIndexOf(".");
  const ext = filename.slice(dotIndex + 1).toLowerCase();
  const contentType = ALLOWED_TYPES[ext];

  if (!contentType) {
    return Response.json(
      { error: "Unsupported file type. Please upload a WAV, AIFF or FLAC file." },
      { status: 415 }
    );
  }

  if (size > MAX_SIZE_BYTES) {
    return Response.json(
      { error: "File is too large. The maximum size is 100 MB." },
      { status: 413 }
    );
  }

  // 4. Create the Sample row
  const id = crypto.randomUUID();
  const key = `samples/${userId}/${id}/original.${ext}`;
  const title = filename.slice(0, dotIndex).trim().slice(0, 200) || "Untitled";

  await prisma.sample.create({
    data: {
      id,
      ownerId: userId,
      title,
      originalKey: key,
      status: "UPLOADING",
    },
  });

  // 5. Create a presigned URL the browser can upload to directly
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 600 } // valid for 10 minutes
  );

  return Response.json(
    { sampleId: id, uploadUrl, contentType },
    { status: 201 }
  );
}