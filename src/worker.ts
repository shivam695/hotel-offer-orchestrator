import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './temporal/activities';
import { config } from './config';

async function main() {
  const connection = await NativeConnection.connect({ address: config.temporalAddress });
  const worker = await Worker.create({
    connection,
    taskQueue: config.taskQueue,
    workflowsPath: require.resolve('./temporal/workflows'),
    activities,
  });
  console.log('Worker started, waiting for orders on queue:', config.taskQueue);
  await worker.run();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});