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
        return { statusCode: 500, headers, body: JSON.stringify({ message: "Database connection failed." }) }; 
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
                           COALESCE(f.tap_number, (SELECT h.tap_number FROM headgates h JOIN field_headgates fh2 ON h.id = fh2.headgate_id WHERE fh2.field_id = f.id LIMIT 1)) as tap_resolved
                    FROM fields f 
                    LEFT JOIN field_headgates fh ON f.id = fh.field_id 
                    GROUP BY f.id
                `);
                return { statusCode: 200, headers, body: JSON.stringify(res.rows.map(row => ({
                    ...row,
                    headgateIds: row.headgate_ids || [],
                    lateral: row.lateral_resolved,
                    tapNumber: row.tap_resolved
                }))) };
            }
            if (httpMethod === 'POST') {
                // Implement UPSERT to handle both Create and Update seamlessly
                await client.query(
                    `INSERT INTO fields (id, name, company_name, address, phone, crop, acres, total_water_allocation, water_allotment, lat, lng, owner, lateral, tap_number) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                     ON CONFLICT (id) DO UPDATE SET 
                        name = EXCLUDED.name,
                        company_name = EXCLUDED.company_name,
                        address = EXCLUDED.address,
                        phone = EXCLUDED.phone,
                        crop = EXCLUDED.crop,
                        acres = EXCLUDED.acres,
                        total_water_allocation = EXCLUDED.total_water_allocation,
                        water_allotment = EXCLUDED.water_allotment,
                        lat = EXCLUDED.lat,
                        lng = EXCLUDED.lng,
                        owner = EXCLUDED.owner,
                        lateral = EXCLUDED.lateral,
                        tap_number = EXCLUDED.tap_number`,
                    [body.id, body.name, body.companyName, body.address, body.phone, body.crop, body.acres, body.totalWaterAllocation, body.waterAllotment, body.lat, body.lng, body.owner, body.lateral, body.tapNumber]
                );
                
                // Refresh Headgate Mapping if provided
                if (body.headgateIds && Array.isArray(body.headgateIds)) {
                    // Clear existing mappings for this field first
                    await client.query("DELETE FROM field_headgates WHERE field_id = $1", [body.id]);
                    for (const hgId of body.headgateIds) {
                        try {
                            await client.query("INSERT INTO field_headgates (field_id, headgate_id) VALUES ($1, $2)", [body.id, hgId]);
                        } catch (e) {
                            console.log("Headgate not in registry, skipping relational link:", hgId);
                        }
                    }
                }
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
                const lateralId = (body.lateralId && body.lateralId !== '') ? body.lateralId : null;
                const headgateId = (body.headgateId && body.headgateId !== '') ? body.headgateId : null;

                await client.query(
                    `INSERT INTO water_orders (id, field_id, field_name, requester, status, order_type, requested_amount, delivery_start_date, lateral_id, headgate_id, tap_number) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                    [id, body.fieldId, body.fieldName, body.requester, body.status, body.orderType, body.requestedAmount, body.deliveryStartDate, lateralId, headgateId, body.tapNumber]
                );
                return { statusCode: 201, headers, body: JSON.stringify({ id }) };
            }
        }

        if (path.startsWith('/orders/') && httpMethod === 'PUT') {
            const orderId = path.split('/').pop();
            await client.query("UPDATE water_orders SET status = $1 WHERE id = $2", [body.status, orderId]);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 404, headers, body: JSON.stringify({ message: `Path not found: ${httpMethod} ${path}` }) };
    } catch (err) {
        console.error("Handler error:", err);
        return { statusCode: 500, headers, body: JSON.stringify({ message: "Internal server error." }) };
    }
};