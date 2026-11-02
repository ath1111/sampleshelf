import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { s3, BUCKET } from "@/lib/storage";
import { MAX_SIZE_BYTES } from "@/lib/upload-rules";
import { enqueueAudioProcessing } from "@/lib/queue";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Must be signed in
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json(
      { error: "You need to sign in to upload." },
      { status: 401 }
    );
  }

  const { id } = await params;

  // 2. The sample must exist AND belong to this user
  const sample = await prisma.sample.findUnique({ where: { id } });
  if (!sample || sample.ownerId !== userId) {
    return Response.json({ error: "Upload not found." }, { status: 404 });
  }

  if (sample.status !== "UPLOADING") {
    return Response.json(
      { error: "This upload has already been completed." },
      { status: 409 }
    );
  }

  // 3. Ask storage whether the file really arrived, and how big it is
  let actualSize: number;
  try {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: sample.originalKey })
    );
    actualSize = head.ContentLength ?? 0;
  } catch {
    return Response.json(
      { error: "The file hasn't finished uploading yet." },
      { status: 400 }
    );
  }

  // 4. Enforce the real size limit
  if (actualSize === 0 || actualSize > MAX_SIZE_BYTES) {
    await s3.send(
      new DeleteObjectCommand({ Bucket: BUCKET, Key: sample.originalKey })
    );
    await prisma.sample.update({
      where: { id },
      data: { status: "FAILED" },
    });
    return Response.json(
      { error: "File is empty or larger than 100 MB." },
      { status: 413 }
    );
  }

  // 5. Move UPLOADING -> PROCESSING, but only if it's still UPLOADING
  const result = await prisma.sample.updateMany({
    where: { id, ownerId: userId, status: "UPLOADING" },
    data: { status: "PROCESSING" },
  });

  if (result.count === 0) {
    return Response.json(
      { error: "This upload has already been completed." },
      { status: 409 }
    );
  }

    // 6. Hand the sample to the background worker
  try {
    await enqueueAudioProcessing(id);
  } catch (err) {
    console.error("Failed to enqueue audio processing", err);
    await prisma.sample.update({
      where: { id },
      data: { status: "UPLOADING" },
    });
    return Response.json(
      { error: "Processing is temporarily unavailable. Please try again." },
      { status: 503 }
    );
  }

  return Response.json({ id, status: "PROCESSING" });

}