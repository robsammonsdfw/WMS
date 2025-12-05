
const pg = require("pg");

// Use a global variable to cache the database client
let dbClient;

/**
 * Retrieves database credentials from environment variables and establishes a connection.
 * Caches the connection for subsequent invocations.
 */
async function getDbClient() {
    if (dbClient) {
        return dbClient;
    }

    const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

    if (!DB_HOST || !DB_PORT || !DB_USER || !DB_PASSWORD || !DB_NAME) {
        throw new Error("Database configuration is incomplete.");
    }
    
    dbClient = new pg.Client({
        host: DB_HOST,
        port: parseInt(DB_PORT, 10),
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        ssl: { rejectUnauthorized: false }
    });

    await dbClient.connect();
    
    // --- SCHEMA INITIALIZATION (Run once/idempotent) ---
    // This ensures the new tables for the Alert/Water Bank feature exist.
    const schemaQuery = `
        CREATE TABLE IF NOT EXISTS accounts (
            id SERIAL PRIMARY KEY,
            account_number VARCHAR(255) UNIQUE NOT NULL,
            owner_name VARCHAR(255),
            total_allocation NUMERIC(10, 2) DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS field_accounts (
            field_id VARCHAR(255), -- Linking to existing fields table (assuming text id)
            account_id INT REFERENCES accounts(id),
            allocation_for_field NUMERIC(10, 2) DEFAULT 0,
            usage_for_field NUMERIC(10, 2) DEFAULT 0,
            is_active BOOLEAN DEFAULT FALSE,
            is_queued BOOLEAN DEFAULT FALSE,
            PRIMARY KEY (field_id, account_id)
        );

        CREATE TABLE IF NOT EXISTS water_bank (
            id SERIAL PRIMARY KEY,
            owner_name VARCHAR(255),
            lateral VARCHAR(50),
            amount_available NUMERIC(10, 2),
            source VARCHAR(100),
            field_association VARCHAR(255)
        );
    `;
    try {
        await dbClient.query(schemaQuery);
    } catch (err) {
        console.error("Schema initialization failed", err);
    }

    return dbClient;
}

exports.handler = async (event) => {
    const headers = {
        "Access-Control-Allow-Origin": "*", 
        "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
    };

    let client;
    try {
        client = await getDbClient();
    } catch (e) {
        console.error("DB Connection Failed", e);
        return { statusCode: 500, headers, body: JSON.stringify({ message: "Database Connection Failed" }) };
    }
    
    let resource, httpMethod;
    const body = event.body ? JSON.parse(event.body) : {};
    const pathParameters = event.pathParameters || {};

    if (event.requestContext && event.requestContext.http) {
        httpMethod = event.requestContext.http.method;
        const rawPath = event.requestContext.http.path; 
        resource = rawPath.replace(/^\/v1/, ''); 
    } else {
        resource = event.resource; // Fallback
        httpMethod = event.httpMethod;
    }

    let response = { headers }; 

    try {
        if (httpMethod === 'OPTIONS') {
            response.statusCode = 200;
            return response;
        }

        // --- Water Order Routes ---
        if (resource === "/orders" && httpMethod === "GET") {
            const result = await client.query("SELECT * FROM water_orders ORDER BY order_date DESC");
            response.statusCode = 200;
            response.body = JSON.stringify(result.rows);
        
        } else if (resource === "/orders" && httpMethod === "POST") {
            const { fieldId, fieldName, requester, status, deliveryStartDate, requestedAmount, ditchRiderId, lateral, serialNumber, tapNumber } = body;
            
            const newOrderId = `WO-${String(Math.floor(Math.random() * 900) + 100)}-${Date.now().toString().slice(-4)}`;
            const orderDate = new Date().toISOString().split('T')[0];

            const query = `
                INSERT INTO water_orders (id, field_id, field_name, requester, status, order_date, requested_amount, ditch_rider_id, lateral, serial_number, delivery_start_date, tap_number)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *;
            `;
            const values = [newOrderId, fieldId, fieldName, requester, status, orderDate, requestedAmount, ditchRiderId, lateral, serialNumber, deliveryStartDate, tapNumber];
            const result = await client.query(query, values);
            response.statusCode = 201;
            response.body = JSON.stringify(result.rows[0]);

        } else if (resource.match(/^\/orders\/[^/]+$/) && httpMethod === "PUT") {
            let id = pathParameters.id || resource.split('/').pop();
            const { status } = body; 
            const query = "UPDATE water_orders SET status = $1 WHERE id = $2 RETURNING *;";
            const result = await client.query(query, [status, id]);
            response.statusCode = 200;
            response.body = JSON.stringify(result.rows[0]);
        
        // --- Field Routes ---
        } else if (resource === "/fields" && httpMethod === "GET") {
            // Enhanced query to fetch fields with their linked accounts and status
            const query = `
                SELECT 
                    f.id, 
                    f.name, 
                    f.crop, 
                    f.acres, 
                    f.location, 
                    f.total_water_allocation as "totalWaterAllocation", 
                    f.water_used as "waterUsed",
                    f.owner,
                    f."lateral", 
                    f.tap_number as "tapNumber",
                    (
                        SELECT COALESCE(json_agg(json_build_object(
                            'id', h.id,
                            'lateral', h.lateral_name,
                            'tapNumber', h.tap_number
                        )), '[]'::json)
                        FROM headgates h
                        WHERE h.field_id = f.id
                    ) AS headgates,
                    (
                        SELECT COALESCE(json_agg(json_build_object(
                            'id', a.id,
                            'accountNumber', a.account_number,
                            'ownerName', a.owner_name,
                            'allocationForField', fa.allocation_for_field,
                            'usageForField', fa.usage_for_field,
                            'isActive', fa.is_active,
                            'isQueued', fa.is_queued
                        )), '[]'::json)
                        FROM accounts a
                        JOIN field_accounts fa ON fa.account_id = a.id
                        WHERE fa.field_id = f.id
                    ) AS accounts
                FROM fields f
                ORDER BY f.name ASC;
            `;
            const result = await client.query(query);
            response.statusCode = 200;
            response.body = JSON.stringify(result.rows);

        // --- New Route: Update Field Account Queue ---
        } else if (resource.match(/^\/fields\/[^/]+\/accounts$/) && httpMethod === "PUT") {
            // Logic to update the queued account for a field
            let id = pathParameters.id || resource.split('/')[2]; // /fields/{id}/accounts
            const { nextAccountId } = body;

            if (!nextAccountId) {
                response.statusCode = 400;
                response.body = JSON.stringify({ message: "nextAccountId is required" });
            } else {
                // 1. Clear existing queue for this field
                await client.query("UPDATE field_accounts SET is_queued = FALSE WHERE field_id = $1", [id]);
                
                // 2. Set new queued account
                const updateQuery = "UPDATE field_accounts SET is_queued = TRUE WHERE field_id = $1 AND account_id = $2 RETURNING *";
                await client.query(updateQuery, [id, nextAccountId]);

                response.statusCode = 200;
                response.body = JSON.stringify({ message: "Queue updated successfully" });
            }
            
        // --- Water Bank Route ---
        } else if (resource === "/water-bank" && httpMethod === "GET") {
             // Basic fetch for water bank table
             const result = await client.query("SELECT * FROM water_bank");
             // Helper to map snake to camel if needed, but simple return for now
             const mapped = result.rows.map(row => ({
                 id: row.id,
                 ownerName: row.owner_name,
                 lateral: row.lateral,
                 amountAvailable: row.amount_available,
                 source: row.source,
                 fieldAssociation: row.field_association
             }));
             response.statusCode = 200;
             response.body = JSON.stringify(mapped);

        } else {
            response.statusCode = 404;
            response.body = JSON.stringify({ message: `Route not found: ${httpMethod} ${resource}` });
        }
    } catch (error) {
        console.error("Handler error:", error);
        response.statusCode = 500;
        response.body = JSON.stringify({ message: "Internal Server Error", error: error.message });
    }
    
    return response;
};
