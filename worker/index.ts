import "dotenv/config";
import { Worker, type Job } from "bullmq";
import { prisma } from "../lib/prisma";
import {
  AUDIO_QUEUE_NAME,
  getRedisConnection,
  type AudioJobData,
} from "../lib/queue";

async function processSample(job: Job<AudioJobData>) {
  const { sampleId } = job.data;

  const sample = await prisma.sample.findUnique({ where: { id: sampleId } });

  if (!sample) {
    console.warn(`[job ${job.id}] Sample ${sampleId} no longer exists, skipping.`);
    return;
  }

  if (sample.status !== "PROCESSING") {
    console.warn(
      `[job ${job.id}] Sample ${sampleId} is ${sample.status}, not PROCESSING, skipping.`
    );
    return;
  }

  console.log(`[job ${job.id}] Processing "${sample.title}" (${sample.originalKey})`);

  // Next steps: download the file, analyze it, make the preview
  // and waveform, then mark the sample READY.
}

const worker = new Worker<AudioJobData>(AUDIO_QUEUE_NAME, processSample, {
  connection: getRedisConnection(),
  concurrency: 2,
});

worker.on("ready", () => {
  console.log(`Worker listening on queue "${AUDIO_QUEUE_NAME}"`);
});

worker.on("completed", (job) => {
  console.log(`[job ${job.id}] Done`);
});

worker.on("failed", (job, err) => {
  console.error(`[job ${job?.id}] Failed (attempt ${job?.attemptsMade}):`, err.message);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, closing worker...`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));