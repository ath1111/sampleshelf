import "dotenv/config";
import { getAudioQueue } from "../lib/queue";

async function main() {
  const queue = getAudioQueue();

  const job = await queue.add("process-sample", { sampleId: "test" });
  console.log("Added job:", job.id, job.name, job.data);

  const counts = await queue.getJobCounts("waiting", "active", "completed", "failed");
  console.log("Job counts:", counts);

  await job.remove();
  console.log("Removed test job.");

  await queue.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});