
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
    const client = await getDbClient();
    
    // --- ADAPTER FOR HTTP API vs REST API ---
    // HTTP API (v2) uses event.routeKey (e.g. "GET /orders")
    // REST API (v1) uses event.resource (e.g. "/orders") + event.httpMethod
    
    let resource, httpMethod;
    const pathParameters = event.pathParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};

    if (event.routeKey) {
        // Handle HTTP API Format
        const [method, path] = event.routeKey.split(' ');
        httpMethod = method;
        resource = path; // In v2, routeKey preserves the parameter placeholders like /orders/{id}
    } else {
        // Handle REST API Format (Legacy)
        resource = event.resource;
        httpMethod = event.httpMethod;
    }

    console.log(`Processing: ${httpMethod} ${resource}`);

    let response;

    try {
        // --- Water Order Routes ---
        if (resource === "/orders" && httpMethod === "GET") {
            const result = await client.query("SELECT * FROM water_orders ORDER BY order_date DESC");
            response = { statusCode: 200, body: JSON.stringify(result.rows) };
        
        } else if (resource === "/orders" && httpMethod === "POST") {
            const { fieldId, fieldName, requester, status, deliveryStartDate, requestedAmount, ditchRiderId, lateral, serialNumber, tapNumber } = body;
            // Basic validation
            if (!fieldId || !requestedAmount) {
                return { statusCode: 400, body: JSON.stringify({ message: "Missing required fields." }) };
            }
            const newOrderId = `WO-${String(Math.floor(Math.random() * 900) + 100)}-${Date.now().toString().slice(-4)}`;
            const orderDate = new Date().toISOString().split('T')[0];

            const query = `
                INSERT INTO water_orders (id, field_id, field_name, requester, status, order_date, requested_amount, ditch_rider_id, lateral, serial_number, delivery_start_date, tap_number)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *;
            `;
            const values = [newOrderId, fieldId, fieldName, requester, status, orderDate, requestedAmount, ditchRiderId, lateral, serialNumber, deliveryStartDate, tapNumber];
            const result = await client.query(query, values);
            response = { statusCode: 201, body: JSON.stringify(result.rows[0]) };

        } else if (resource === "/orders/{id}" && httpMethod === "PUT") {
            const { id } = pathParameters;
            const { status, requester } = body; 
            
            // We use COALESCE or dynamic query building in a real app, but for now we update status and/or requester
            // Note: If you need to update other fields, add them to the query
            const query = "UPDATE water_orders SET status = $1 WHERE id = $2 RETURNING *;";
            const result = await client.query(query, [status, id]);
            response = { statusCode: 200, body: JSON.stringify(result.rows[0]) };
        
        // --- Fields Routes ---
        } else if (resource === "/fields" && httpMethod === "GET") {
            const result = await client.query("SELECT * FROM fields ORDER BY name ASC");
            response = { statusCode: 200, body: JSON.stringify(result.rows) };
        
        } else {
            response = { statusCode: 404, body: JSON.stringify({ message: `Route not found: ${httpMethod} ${resource}` }) };
        }
    } catch (error) {
        console.error("Handler error:", error);
        response = { statusCode: 500, body: JSON.stringify({ message: "Internal Server Error", error: error.message }) };
    }
    
    // Add CORS headers to every response
    response.headers = {
        "Access-Control-Allow-Origin": "*", 
        "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
    };
    
    return response;
};
