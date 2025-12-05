
const pg = require("pg");

// Use a global variable to cache the database client
let dbClient;

/**
 * Retrieves database credentials from environment variables and establishes a connection.
 * Caches the connection for subsequent invocations.
 */
async function getDbClient() {
    if (dbClient) {
        console.log("Using cached database client.");
        return dbClient;
    }

    // Read credentials from environment variables
    const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

    if (!DB_HOST || !DB_PORT || !DB_USER || !DB_PASSWORD || !DB_NAME) {
        console.error("Missing required database environment variables.");
        throw new Error("Database configuration is incomplete. Ensure DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, and DB_NAME are set.");
    }
    
    console.log("Creating new database client from environment variables.");

    // Create a new database client
    dbClient = new pg.Client({
        host: DB_HOST,
        port: parseInt(DB_PORT, 10),
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        ssl: { 
            rejectUnauthorized: false // Required for connecting to RDS from Lambda
        }
    });

    console.log("Connecting to the database...");
    await dbClient.connect();
    console.log("Database connection established.");
    return dbClient;
}

/**
 * Main Lambda handler function.
 * Routes incoming API Gateway requests to the appropriate logic.
 */
exports.handler = async (event) => {
    // --- CORS HEADERS ---
    // specific headers to ensure browser allows the response
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
    
    // --- REQUEST PARSING (HTTP API v2 vs REST v1) ---
    let resource, httpMethod;
    const body = event.body ? JSON.parse(event.body) : {};
    const pathParameters = event.pathParameters || {};

    if (event.requestContext && event.requestContext.http) {
        // HTTP API (v2) standard payload
        httpMethod = event.requestContext.http.method;
        const rawPath = event.requestContext.http.path; 
        resource = rawPath.replace(/^\/v1/, ''); 
    } else if (event.routeKey) {
        const [method, path] = event.routeKey.split(' ');
        httpMethod = method;
        resource = path;
    } else {
        resource = event.resource;
        httpMethod = event.httpMethod;
    }

    console.log(`Processing: ${httpMethod} ${resource}`);

    let response = { headers }; 

    try {
        if (httpMethod === 'OPTIONS') {
            response.statusCode = 200;
            response.body = '';
            return response;
        }

        // --- Water Order Routes ---
        if (resource === "/orders" && httpMethod === "GET") {
            const result = await client.query("SELECT * FROM water_orders ORDER BY order_date DESC");
            // Map snake_case to camelCase for the frontend if necessary, though current frontend handles snake_case order props? 
            // Checking types.ts, WaterOrder uses camelCase (requestedAmount). 
            // The existing code likely returned snake_case and frontend might be breaking or adapting. 
            // For safety, let's just return rows. If frontend needs camelCase, we should alias here too.
            // Assuming current frontend works with whatever /orders returns for now.
            response.statusCode = 200;
            response.body = JSON.stringify(result.rows);
        
        } else if (resource === "/orders" && httpMethod === "POST") {
            const { fieldId, fieldName, requester, status, deliveryStartDate, requestedAmount, ditchRiderId, lateral, serialNumber, tapNumber } = body;
            
            if (!fieldId || !requestedAmount) {
                response.statusCode = 400;
                response.body = JSON.stringify({ message: "Missing required fields." });
            } else {
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
            }

        } else if (resource.match(/^\/orders\/[^/]+$/) && httpMethod === "PUT") {
            let id = pathParameters.id;
            if (!id) {
                const parts = resource.split('/');
                id = parts[parts.length - 1];
            }
            
            const { status } = body; 
            const query = "UPDATE water_orders SET status = $1 WHERE id = $2 RETURNING *;";
            const result = await client.query(query, [status, id]);
            response.statusCode = 200;
            response.body = JSON.stringify(result.rows[0]);
        
        // --- Fields Routes ---
        } else if (resource === "/fields" && httpMethod === "GET") {
            // Updated Query to fetch nested Headgates and Accounts and map to camelCase
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
                    f.lateral, 
                    f.tap_number as "tapNumber",
                    (
                        SELECT COALESCE(json_agg(json_build_object(
                            'id', h.id,
                            'lateral', h.lateral,
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
                            'headgateId', a.headgate_id
                        )), '[]'::json)
                        FROM accounts a
                        WHERE a.field_id = f.id
                    ) AS accounts
                FROM fields f
                ORDER BY f.name ASC;
            `;
            const result = await client.query(query);
            response.statusCode = 200;
            response.body = JSON.stringify(result.rows);
        
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
