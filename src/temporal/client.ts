import { randomUUID } from 'crypto';
import { Client, Connection } from '@temporalio/client';
import { config } from '../config';
import type { hotelOffersWorkflow } from './workflows';
import type { Hotel } from '../types';

let client: Client | undefined;

async function getClient() {
  if (!client) {
    const connection = await Connection.connect({ address: config.temporalAddress });
    client = new Client({ connection });
  }
  return client;
}

export async function runHotelWorkflow(city: string): Promise<Hotel[]> {
  const c = await getClient();
  return c.workflow.execute<typeof hotelOffersWorkflow>('hotelOffersWorkflow', {
    taskQueue: config.taskQueue,
    workflowId: `hotel-offers-${city}-${randomUUID()}`, // every order gets a unique ID
    args: [city],
    workflowExecutionTimeout: '20 seconds',
  });
}