const { redisStore } = require('cache-manager-redis-yet');

async function run() {
    try {
        const store = await redisStore({ url: 'redis://localhost:6379' });
        console.log("Store keys:", Object.keys(store));
        if (store.client) {
            console.log("Found client directly on store!");
            process.exit(0);
        }
        process.exit(0);
    } catch (e) {
        console.error("REDIS CONNECT ERROR:", e);
        process.exit(1);
    }
}
run();
