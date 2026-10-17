const { neon } = require('@neondatabase/serverless');

function getDb(env) {
    const url = (env && env.DATABASE_URL) || process.env.DATABASE_URL;
    if (!url) {
        throw new Error('DATABASE_URL is not configured');
    }
    return neon(url);
}

module.exports = { getDb };

