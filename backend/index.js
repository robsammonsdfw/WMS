
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

    const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

    console.log(`Initializing DB connection to ${DB_HOST}:${DB_PORT}/${DB_NAME}`);

    if (!DB_HOST || !DB_PORT || !DB_USER || !DB_PASSWORD || !DB_NAME) {
        console.error("Missing database configuration variables.");
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

    try {
        await dbClient.connect();
        console.log("Database connected successfully.");
    } catch (err) {
        console.error("Error connecting to database:", err);
        throw err;
    }
    
    // --- SCHEMA INITIALIZATION & MIGRATION ---
    const schemaQuery = `
        CREATE TABLE IF NOT EXISTS fields (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255),
            crop VARCHAR(255),
            acres NUMERIC,
            location VARCHAR(255),
            total_water_allocation NUMERIC,
            water_used NUMERIC,
            owner VARCHAR(255),
            "lateral" VARCHAR(50),
            tap_number VARCHAR(50)
        );

        CREATE TABLE IF NOT EXISTS water_orders (
            id VARCHAR(255) PRIMARY KEY,
            field_id VARCHAR(255),
            field_name VARCHAR(255),
            requester VARCHAR(255),
            status VARCHAR(50),
            order_date TIMESTAMP,
            requested_amount NUMERIC,
            ditch_rider_id INT,
            "lateral" VARCHAR(50),
            serial_number VARCHAR(100),
            delivery_start_date DATE,
            tap_number VARCHAR(50)
        );

        CREATE TABLE IF NOT EXISTS accounts (
            id SERIAL PRIMARY KEY,
            account_number VARCHAR(255) UNIQUE NOT NULL,
            owner_name VARCHAR(255),
            total_allocation NUMERIC(10, 2) DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS field_accounts (
            field_id VARCHAR(255), 
            account_id INT REFERENCES accounts(id),
            allocation_for_field NUMERIC(10, 2) DEFAULT 0,
            usage_for_field NUMERIC(10, 2) DEFAULT 0,
            is_active BOOLEAN DEFAULT FALSE,
            is_queued BOOLEAN DEFAULT FALSE,
            PRIMARY KEY (field_id, account_id)
        );

        CREATE TABLE IF NOT EXISTS water_bank (
            id SERIAL PRIMARY KEY,
            account_id INT REFERENCES accounts(id),
            "lateral" VARCHAR(50),
            amount_available NUMERIC(10, 2),
            source VARCHAR(100),
            field_association VARCHAR(255),
            created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE OR REPLACE VIEW water_bank_view AS
        SELECT 
            wb.id,
            a.owner_name,
            wb."lateral",
            wb.amount_available,
            wb.source,
            wb.field_association
        FROM water_bank wb
        LEFT JOIN accounts a ON wb.account_id = a.id;

        -- Trigger Logic for Auto-Switching
        CREATE OR REPLACE FUNCTION check_usage_limit() RETURNS TRIGGER AS $$
        DECLARE
            queued_account_id INT;
        BEGIN
            IF NEW.usage_for_field >= NEW.allocation_for_field AND NEW.is_active = TRUE THEN
                SELECT account_id INTO queued_account_id
                FROM field_accounts
                WHERE field_id = NEW.field_id AND is_queued = TRUE
                LIMIT 1;

                IF FOUND THEN
                    UPDATE field_accounts SET is_active = FALSE WHERE field_id = NEW.field_id AND account_id = NEW.account_id;
                    UPDATE field_accounts SET is_active = TRUE, is_queued = FALSE WHERE field_id = NEW.field_id AND account_id = queued_account_id;
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trigger_check_usage_limit ON field_accounts;
        CREATE TRIGGER trigger_check_usage_limit
        AFTER UPDATE OF usage_for_field ON field_accounts
        FOR EACH ROW
        EXECUTE FUNCTION check_usage_limit();
    `;

    try {
        console.log("Running schema check...");
        await dbClient.query(schemaQuery);
        console.log("Schema check complete.");
        
        // --- DATA MIGRATION CHECK ---
        // If accounts table is empty but fields exist, create default accounts for existing fields
        const checkAccounts = await dbClient.query("SELECT COUNT(*) FROM accounts");
        if (parseInt(checkAccounts.rows[0].count) === 0) {
             console.log("Migrating legacy fields to accounts...");
             const existingFields = await dbClient.query("SELECT * FROM fields");
             for (const field of existingFields.rows) {
                 if (field.owner) {
                     // Create/Get Account
                     const accRes = await dbClient.query(
                         `INSERT INTO accounts (account_number, owner_name, total_allocation) 
                          VALUES ($1, $2, $3) 
                          ON CONFLICT (account_number) DO UPDATE SET total_allocation = accounts.total_allocation
                          RETURNING id`,
                         [`ACC-${field.id}`, field.owner, 1000] // Dummy account number and default global alloc
                     );
                     const accId = accRes.rows[0].id;
                     
                     // Link Field to Account
                     await dbClient.query(
                         `INSERT INTO field_accounts (field_id, account_id, allocation_for_field, usage_for_field, is_active)
                          VALUES ($1, $2, $3, $4, TRUE)
                          ON CONFLICT DO NOTHING`,
                          [field.id, accId, field.total_water_allocation, field.water_used]
                     );
                 }
             }
             console.log("Migration complete.");
        }

    } catch (e) {
        console.error("Schema init/migration failed:", e);
    }

    return dbClient;
}

exports.handler = async (event) => {
    console.log("Lambda Handler Event:", JSON.stringify(event));

    // Handling CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
            },
            body: JSON.stringify({ message: "CORS preflight check passed" })
        };
    }

    let client;
    try {
        client = await getDbClient();
    } catch (e) {
        console.error("FATAL: Could not connect to database in handler.", e);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Database connection failed" })
        };
    }

    const { httpMethod, path, body } = event;

    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
    };

    // Wrapper for query logging
    const queryDb = async (queryText, params) => {
        console.log(`[DB Query] ${queryText}`, params ? JSON.stringify(params) : '');
        try {
            const start = Date.now();
            const res = await client.query(queryText, params);
            console.log(`[DB Success] Rows affected: ${res.rowCount} (${Date.now() - start}ms)`);
            return res;
        } catch (err) {
            console.error(`[DB Error] ${err.message}`, err);
            throw err;
        }
    };

    try {
        // --- WATER ORDER ENDPOINTS ---
        if (path === '/orders' && httpMethod === 'GET') {
            console.log("Fetching all orders");
            const res = await queryDb("SELECT * FROM water_orders ORDER BY order_date DESC");
            // Map keys to camelCase for frontend
            const orders = res.rows.map(row => ({
                id: row.id,
                fieldId: row.field_id,
                fieldName: row.field_name,
                requester: row.requester,
                status: row.status,
                orderDate: row.order_date,
                requestedAmount: parseFloat(row.requested_amount),
                ditchRiderId: row.ditch_rider_id,
                lateral: row.lateral,
                serialNumber: row.serial_number,
                deliveryStartDate: row.delivery_start_date,
                tapNumber: row.tap_number
            }));
            return { statusCode: 200, headers, body: JSON.stringify(orders) };
        }

        if (path === '/orders' && httpMethod === 'POST') {
            console.log("Creating new order. Body:", body);
            const data = JSON.parse(body);
            const id = Math.random().toString(36).substring(2, 9);
            const now = new Date().toISOString();
            
            await queryDb(
                `INSERT INTO water_orders (id, field_id, field_name, requester, status, order_date, requested_amount, "lateral", delivery_start_date, tap_number) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [id, data.fieldId, data.fieldName, data.requester, data.status, now, data.requestedAmount, data.lateral, data.deliveryStartDate, data.tapNumber]
            );

            console.log("Order created successfully with ID:", id);
            return { statusCode: 201, headers, body: JSON.stringify({ message: "Order created", id }) };
        }

        if (path.match(/^\/orders\/[a-zA-Z0-9-]+$/) && httpMethod === 'PUT') {
            const orderId = path.split('/').pop();
            console.log(`Updating order ${orderId}. Body:`, body);
            const data = JSON.parse(body);
            
            await queryDb(
                `UPDATE water_orders SET status = $1 WHERE id = $2`,
                [data.status, orderId]
            );

            // TODO: If order completed, update water_used in fields table & field_accounts table
            if (data.status === 'Completed') {
                console.log("Order completed. Updating usage stats.");
                // 1. Get order details
                const orderRes = await queryDb("SELECT field_id, requested_amount FROM water_orders WHERE id = $1", [orderId]);
                if(orderRes.rows.length > 0) {
                    const { field_id, requested_amount } = orderRes.rows[0];
                    const amount = parseFloat(requested_amount);
                    
                    // 2. Update Field Total
                    await queryDb("UPDATE fields SET water_used = COALESCE(water_used, 0) + $1 WHERE id = $2", [amount, field_id]);
                    
                    // 3. Update Active Account Usage (Triggers auto-switch via DB Trigger if limit reached)
                    await queryDb(`
                        UPDATE field_accounts 
                        SET usage_for_field = usage_for_field + $1 
                        WHERE field_id = $2 AND is_active = TRUE
                    `, [amount, field_id]);
                }
            }

            return { statusCode: 200, headers, body: JSON.stringify({ message: "Order updated" }) };
        }

        // --- FIELDS ENDPOINTS ---
        if (path === '/fields' && httpMethod === 'GET') {
            // Get Basic Fields
            const fieldsRes = await queryDb("SELECT * FROM fields ORDER BY name ASC");
            
            // For each field, fetch linked accounts
            const allAccountsRes = await queryDb(`
                SELECT fa.*, a.account_number, a.owner_name 
                FROM field_accounts fa 
                JOIN accounts a ON fa.account_id = a.id
            `);

            const fields = fieldsRes.rows.map(row => {
                const linkedAccounts = allAccountsRes.rows
                    .filter(acc => acc.field_id === row.id)
                    .map(acc => ({
                        id: acc.account_id,
                        accountNumber: acc.account_number,
                        ownerName: acc.owner_name,
                        allocationForField: parseFloat(acc.allocation_for_field),
                        usageForField: parseFloat(acc.usage_for_field),
                        isActive: acc.is_active,
                        isQueued: acc.is_queued
                    }));

                return {
                    id: row.id,
                    name: row.name,
                    crop: row.crop,
                    acres: parseFloat(row.acres),
                    location: row.location,
                    totalWaterAllocation: parseFloat(row.total_water_allocation),
                    waterUsed: parseFloat(row.water_used),
                    owner: row.owner,
                    lateral: row.lateral, 
                    tapNumber: row.tap_number,
                    accounts: linkedAccounts
                };
            });

            return { statusCode: 200, headers, body: JSON.stringify(fields) };
        }

        // --- ACCOUNT QUEUE ENDPOINT ---
        if (path.match(/^\/fields\/[a-zA-Z0-9-]+\/accounts$/) && httpMethod === 'PUT') {
            const fieldId = path.split('/')[2]; // /fields/:id/accounts
            console.log(`Updating account queue for field ${fieldId}. Body:`, body);
            const { nextAccountId } = JSON.parse(body);

            // 1. Reset current queue for this field
            await queryDb("UPDATE field_accounts SET is_queued = FALSE WHERE field_id = $1", [fieldId]);
            
            // 2. Set new queued account
            await queryDb("UPDATE field_accounts SET is_queued = TRUE WHERE field_id = $1 AND account_id = $2", [fieldId, nextAccountId]);

            return { statusCode: 200, headers, body: JSON.stringify({ message: "Queue updated" }) };
        }

        // --- WATER BANK ENDPOINT ---
        if (path === '/water-bank' && httpMethod === 'GET') {
            const res = await queryDb("SELECT * FROM water_bank_view ORDER BY amount_available DESC");
             const bankEntries = res.rows.map(row => ({
                id: row.id,
                ownerName: row.owner_name,
                lateral: row.lateral,
                amountAvailable: parseFloat(row.amount_available),
                source: row.source,
                fieldAssociation: row.field_association
            }));
            return { statusCode: 200, headers, body: JSON.stringify(bankEntries) };
        }

        console.log("Endpoint not found:", path, httpMethod);
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ message: "Endpoint not found" })
        };

    } catch (err) {
        console.error("Handler Error:", err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ message: err.message })
        };
    }
};
