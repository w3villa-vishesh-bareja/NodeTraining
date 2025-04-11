import { createClient } from 'redis';
const redis = createClient({url: 'redis://localhost:6379'});
try {
    await redis.connect();
} catch (error) {
    throw new Error(error)
}
export default redis;