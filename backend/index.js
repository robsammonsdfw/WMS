const pg = require("pg");

let dbClient = null;

async function initSchema(client) {
    console.log("Checking/Initializing Database Schema...");
    await client.query(`
        CREATE TABLE IF NOT EXISTS laterals (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS headgates (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            lateral_id VARCHAR(255) NOT NULL REFERENCES laterals(id),
            tap_number VARCHAR(50)
        );

        CREATE TABLE IF NOT EXISTS fields (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255),
            crop VARCHAR(255),
            acres NUMERIC,
            location VARCHAR(255),
            total_water_allocation NUMERIC,
            water_used NUMERIC DEFAULT 0,
            owner VARCHAR(255),
            company_name VARCHAR(255),
            address TEXT,
            phone VARCHAR(50),
            lat NUMERIC,
            lng NUMERIC,
            water_allotment NUMERIC DEFAULT 0,
            allotment_used NUMERIC DEFAULT 0,
            lateral VARCHAR(255),
            tap_number VARCHAR(255)
        );

        CREATE TABLE IF NOT EXISTS field_headgates (
            field_id VARCHAR(255) REFERENCES fields(id) ON DELETE CASCADE,
            headgate_id VARCHAR(255) REFERENCES headgates(id) ON DELETE CASCADE,
            PRIMARY KEY (field_id, headgate_id)
        );

        CREATE TABLE IF NOT EXISTS water_orders (
            id VARCHAR(255) PRIMARY KEY,
            field_id VARCHAR(255) REFERENCES fields(id),
            field_name VARCHAR(255),
            requester VARCHAR(255),
            status VARCHAR(50), 
            order_type VARCHAR(50),
            order_date TIMESTAMP DEFAULT NOW(),
            requested_amount NUMERIC,
            delivery_start_date DATE,
            lateral_id VARCHAR(255) REFERENCES laterals(id),
            headgate_id VARCHAR(255) REFERENCES headgates(id),
            tap_number VARCHAR(50)
        );

        CREATE TABLE IF NOT EXISTS accounts (
            id SERIAL PRIMARY KEY,
            account_number VARCHAR(255) UNIQUE NOT NULL,
            owner_name VARCHAR(255),
            total_allocation NUMERIC(10, 2) DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS field_accounts (
            field_id VARCHAR(255) REFERENCES fields(id) ON DELETE CASCADE, 
            account_id INT REFERENCES accounts(id) ON DELETE CASCADE,
            allocation_for_field NUMERIC(10, 2) DEFAULT 0,
            usage_for_field NUMERIC(10, 2) DEFAULT 0,
            is_active BOOLEAN DEFAULT FALSE,
            is_queued BOOLEAN DEFAULT FALSE,
            PRIMARY KEY (field_id, account_id)
        );
    `);
}

async function getDbClient() {
    // 1. Check if we have an existing client and if it's still alive
    if (dbClient) {
        try {
            await dbClient.query('SELECT 1');
            return dbClient;
        } catch (e) {
            console.warn("Existing DB connection is dead or stale. Reconnecting...");
            try { await dbClient.end(); } catch (err) {}
            dbClient = null;
        }
    }

    const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
    
    // 2. Validate environment configuration
    if (!DB_HOST || !DB_PASSWORD || !DB_NAME) {
        const missing = [];
        if (!DB_HOST) missing.push("DB_HOST");
        if (!DB_PASSWORD) missing.push("DB_PASSWORD");
        if (!DB_NAME) missing.push("DB_NAME");
        throw new Error(`Database configuration incomplete. Missing variables: ${missing.join(", ")}`);
    }

    console.log(`Connecting to database at ${DB_HOST}...`);

    const client = new pg.Client({
        host: DB_HOST,
        port: parseInt(DB_PORT || "5432", 10),
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000 // Stop waiting after 5 seconds
    });

    try {
        await client.connect();
        await initSchema(client);
        dbClient = client; // Success! Store in global for reuse
        return dbClient;
    } catch (err) {
        console.error("FATAL: Database connection failed.", err);
        dbClient = null; // Ensure we don't store a broken client
        throw err;
    }
}

exports.handler = async (event) => {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,x-api-key,X-Requested-With",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Max-Age": "3600"
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    const headers = { ...corsHeaders, "Content-Type": "application/json" };
    let path = event.path || "";
    const httpMethod = event.httpMethod;

    path = path.replace(/^\/(v1|prod|dev|v2)/, "");
    if (path === "") path = "/";

    let client;
    try { 
        client = await getDbClient(); 
    } catch (e) { 
        console.error("API Error: getDbClient failed", e.message);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ 
                message: "Database connection failed.", 
                details: e.message,
                hint: "Check Lambda Environment Variables and RDS Security Group rules."
            }) 
        }; 
    }

    try {
        const body = event.body ? JSON.parse(event.body) : null;

        if (path === '/admin/reset-db' && httpMethod === 'POST') {
            await client.query("DROP TABLE IF EXISTS field_accounts, field_headgates, water_orders, headgates, laterals, fields, accounts CASCADE");
            await initSchema(client);
            return { statusCode: 200, headers, body: JSON.stringify({ message: "Database Cleaned" }) };
        }

        if (path === '/laterals') {
            if (httpMethod === 'GET') {
                const res = await client.query("SELECT * FROM laterals ORDER BY name ASC");
                return { statusCode: 200, headers, body: JSON.stringify(res.rows) };
            }
            if (httpMethod === 'POST') {
                await client.query("INSERT INTO laterals (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name", [body.id, body.name]);
                return { statusCode: 201, headers, body: JSON.stringify(body) };
            }
        }

        if (path === '/headgates') {
            if (httpMethod === 'GET') {
                const res = await client.query("SELECT h.*, l.name as lateral_name FROM headgates h JOIN laterals l ON h.lateral_id = l.id");
                return { statusCode: 200, headers, body: JSON.stringify(res.rows) };
            }
            if (httpMethod === 'POST') {
                await client.query(
                    "INSERT INTO headgates (id, name, lateral_id, tap_number) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, lateral_id = EXCLUDED.lateral_id, tap_number = EXCLUDED.tap_number", 
                    [body.id, body.name, body.lateralId, body.tapNumber]
                );
                return { statusCode: 201, headers, body: JSON.stringify(body) };
            }
        }

        if (path === '/fields') {
            if (httpMethod === 'GET') {
                const res = await client.query(`
                    SELECT f.*, 
                           array_agg(DISTINCT fh.headgate_id) FILTER (WHERE fh.headgate_id IS NOT NULL) as headgate_ids,
                           COALESCE(f.lateral, (SELECT h.lateral_id FROM headgates h JOIN field_headgates fh2 ON h.id = fh2.headgate_id WHERE fh2.field_id = f.id LIMIT 1)) as lateral_resolved,
                           COALESCE(f.tap_number, (SELECT h.tap_number FROM headgates h JOIN field_headgates fh2 ON h.id = fh2.headgate_id WHERE fh2.field_id = f.id LIMIT