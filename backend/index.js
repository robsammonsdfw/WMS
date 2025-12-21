
const pg = require("pg");

let dbClient;

async function initSchema(client) {
    console.log("Running Schema Initialization...");
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
            water_used NUMERIC,
            owner VARCHAR(255)
        );

        CREATE TABLE IF NOT EXISTS field_headgates (
            field_id VARCHAR(255) REFERENCES fields(id),
            headgate_id VARCHAR(255) REFERENCES headgates(id),
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
            field_id VARCHAR(255) REFERENCES fields(id), 
            account_id INT REFERENCES accounts(id),
            allocation_for_field NUMERIC(10, 2) DEFAULT 0,
            usage_for_field NUMERIC(10, 2) DEFAULT 0,
            is_active BOOLEAN DEFAULT FALSE,
            is_queued BOOLEAN DEFAULT FALSE,
            PRIMARY KEY (field_id, account_id)
        );
    `);
}

async function getDbClient() {
    if (dbClient) return dbClient;
    const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
    dbClient = new pg.Client({
        host: DB_HOST,
        port: parseInt(DB_PORT, 10),
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await dbClient.connect();
        await initSchema(dbClient);
    } catch (err) {
        console.error("Error connecting to DB:", err);
        throw err;
    }
    return dbClient;
}

exports.handler = async (event) => {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
    };

    // CRITICAL: Handle OPTIONS immediately for CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders };
    }

    const headers = { ...corsHeaders, "Content-Type": "application/json" };
    
    // Normalize path to handle stage prefixes like /v1/laterals -> /laterals
    let path = event.path || "";
    if (path.startsWith('/v1')) {
        path = path.substring(3);
    }
    const httpMethod = event.httpMethod;

    let client;
    try { 
        client = await getDbClient(); 
    } catch (e) { 
        console.error("DB connection error in handler:", e);
        return { statusCode: 500, headers, body: JSON.stringify({ message: "DB Connect Failed" }) }; 
    }

    try {
        const body = event.body ? JSON.parse(event.body) : null;

        if (path === '/admin/reset-db' && httpMethod === 'POST') {
            await client.query("DROP TABLE IF EXISTS field_accounts, field_headgates, water_orders, headgates, laterals, fields, accounts CASCADE");
            await initSchema(client);
            await client.query("INSERT INTO laterals (id, name) VALUES ('L-A', 'Lateral A'), ('L-B', 'Lateral B')");
            await client.query(`INSERT INTO headgates (id, name, lateral_id, tap_number) VALUES ('HG-A1', 'A-North Gate', 'L-A', 'A-101'), ('HG-B1', 'B-Main Gate', 'L-B', 'B-201')`);
            await client.query(`INSERT INTO fields (id, name, crop, acres, total_water_allocation, water_used) VALUES ('F-01', 'North Meadows', 'Alfalfa', 120, 480, 150), ('F-02', 'River Bend', 'Corn', 80, 320, 40)`);
            await client.query("INSERT INTO field_headgates (field_id, headgate_id) VALUES ('F-01', 'HG-A1'), ('F-02', 'HG-B1')");
            return { statusCode: 200, headers, body: JSON.stringify({ message: "Database reset and seeded." }) };
        }

        if (path === '/laterals') {
            if (httpMethod === 'GET') {
                const res = await client.query("SELECT * FROM laterals ORDER BY name ASC");
                return { statusCode: 200, headers, body: JSON.stringify(res.rows) };
            }
            if (httpMethod === 'POST') {
                await client.query("INSERT INTO laterals (id, name) VALUES ($1, $2)", [body.id, body.name]);
                return { statusCode: 201, headers, body: JSON.stringify(body) };
            }
        }

        if (path === '/headgates') {
            if (httpMethod === 'GET') {
                const res = await client.query("SELECT h.*, l.name as lateral_name FROM headgates h JOIN laterals l ON h.lateral_id = l.id");
                return { statusCode: 200, headers, body: JSON.stringify(res.rows) };
            }
            if (httpMethod === 'POST') {
                await client.query("INSERT INTO headgates (id, name, lateral_id, tap_number) VALUES ($1, $2, $3, $4)", [body.id, body.name, body.lateralId, body.tapNumber]);
                return { statusCode: 201, headers, body: JSON.stringify(body) };
            }
        }

        if (path === '/orders') {
            if (httpMethod === 'GET') {
                const res = await client.query("SELECT o.*, l.name as lateral_name, h.name as headgate_name FROM water_orders o LEFT JOIN laterals l ON o.lateral_id = l.id LEFT JOIN headgates h ON o.headgate_id = h.id ORDER BY delivery_start_date ASC");
                return { statusCode: 200, headers, body: JSON.stringify(res.rows) };
            }
            if (httpMethod === 'POST') {
                const id = 'ORD-' + Math.random().toString(36).substr(2, 5).toUpperCase();
                await client.query(
                    `INSERT INTO water_orders (id, field_id, field_name, requester, status, order_type, requested_amount, delivery_start_date, lateral_id, headgate_id, tap_number) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                    [id, body.fieldId, body.fieldName, body.requester, body.status, body.orderType, body.requestedAmount, body.deliveryStartDate, body.lateralId, body.headgateId, body.tapNumber]
                );
                return { statusCode: 201, headers, body: JSON.stringify({ id }) };
            }
        }

        if (path.startsWith('/orders/') && httpMethod === 'PUT') {
            const orderId = path.split('/').pop();
            await client.query("UPDATE water_orders SET status = $1 WHERE id = $2", [body.status, orderId]);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        if (path === '/fields' && httpMethod === 'GET') {
            const res = await client.query(`
                SELECT f.*, array_agg(fh.headgate_id) as headgate_ids 
                FROM fields f 
                LEFT JOIN field_headgates fh ON f.id = fh.field_id 
                GROUP BY f.id
            `);
            return { statusCode: 200, headers, body: JSON.stringify(res.rows) };
        }

        return { statusCode: 404, headers, body: JSON.stringify({ message: `Path ${path} not found` }) };
    } catch (err) {
        console.error("Handler Exception:", err);
        return { statusCode: 500, headers, body: JSON.stringify({ message: err.message }) };
    }
};
