import { createClient } from 'redis';
import { configDotenv } from 'dotenv';
configDotenv();
const redis = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    }
});
try {
    await redis.connect();
    console.log("redis connected")
} catch (error) {
    throw new Error(error)
}
export default redis;