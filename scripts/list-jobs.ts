import "dotenv/config";
import { getAudioQueue } from "../lib/queue";

async function main() {
  const queue = getAudioQueue();

  const counts = await queue.getJobCounts("waiting", "active", "completed", "failed");
  console.log("Job counts:", counts);

  const jobs = await queue.getJobs(["waiting"]);
  for (const job of jobs) {
    console.log(`- job ${job.id}: ${job.name}`, job.data);
  }

  await queue.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});