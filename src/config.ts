export const config = {
  port: Number(process.env.PORT ?? 3000),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6380',
  temporalAddress: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
  supplierBaseUrl: process.env.SUPPLIER_BASE_URL ?? 'http://localhost:3000',
  taskQueue: 'hotel-offers',
};