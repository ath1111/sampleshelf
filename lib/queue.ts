import { Queue, type ConnectionOptions } from "bullmq";

export const AUDIO_QUEUE_NAME = "audio-processing";

export type AudioJobData = {
  sampleId: string;
};

export function getRedisConnection(): ConnectionOptions {
  const raw = process.env.REDIS_URL;
  if (!raw) {
    throw new Error("Missing environment variable: REDIS_URL");
  }
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

const globalForQueue = globalThis as unknown as {
  audioQueue?: Queue<AudioJobData>;
};

export function getAudioQueue(): Queue<AudioJobData> {
  if (!globalForQueue.audioQueue) {
    globalForQueue.audioQueue = new Queue<AudioJobData>(AUDIO_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return globalForQueue.audioQueue;
}

export async function enqueueAudioProcessing(sampleId: string) {
  await getAudioQueue().add("process-sample", { sampleId });
}