import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const publisher = new Redis(redisUrl);
const subscriber = new Redis(redisUrl);

export const EventBus = {
  publish: async (channel: string, message: any) => {
    await publisher.publish(channel, JSON.stringify(message));
  },
  subscribe: (channel: string, callback: (message: any) => void) => {
    subscriber.subscribe(channel);
    subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        try {
          callback(JSON.parse(msg));
        } catch (e) {
          callback(msg);
        }
      }
    });
  }
};
