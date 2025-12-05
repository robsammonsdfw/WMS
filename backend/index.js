
const pg = require("pg");

// Use a global variable to cache the database client
let dbClient;

/**
 * Shared Schema Initialization Logic
 * Defines the tables and views required for the application.
 */
async function initSchema(client) {
    console.log("Running Schema Initialization...");
    await client.query(`
        -- 1. Fields Table
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

        -- 2. Water Orders Table
        -- Note: status is VARCHAR to be flexible, preventing ENUM issues during development
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

        -- 3. Accounts Table
        CREATE TABLE IF NOT EXISTS accounts (
            id SERIAL PRIMARY KEY,
            account_number VARCHAR(255) UNIQUE NOT NULL,
            owner_name VARCHAR(255),
            total_allocation NUMERIC(10, 2) DEFAULT 0
        );
        -- Self-heal: Ensure column exists if table was created previously
        ALTER TABLE accounts ADD COLUMN IF NOT EXISTS total_allocation NUMERIC(10, 2) DEFAULT 0;

        -- 4. Field-Account Link Table (Many-to-Many with Usage Stats)
        CREATE TABLE IF NOT EXISTS field_accounts (
            field_id VARCHAR(255), 
            account_id INT REFERENCES accounts(id),
            allocation_for_field NUMERIC(10, 2) DEFAULT 0,
            usage_for_field NUMERIC(10, 2) DEFAULT 0,
            is_active BOOLEAN DEFAULT FALSE,
            is_queued BOOLEAN DEFAULT FALSE,
            PRIMARY KEY (field_id, account_id)
        );

        -- 5. Water Bank Table
        CREATE TABLE IF NOT EXISTS water_bank (
            id SERIAL PRIMARY KEY,
            account_id INT REFERENCES accounts(id),
            "lateral" VARCHAR(50),
            amount_available NUMERIC(10, 2),
            source VARCHAR(100),
            field_association VARCHAR(255),
            created_at TIMESTAMP DEFAULT NOW()
        );

        -- 6. Water Bank View
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

        -- 7. Trigger Logic for Auto-Switching Accounts
        CREATE OR REPLACE FUNCTION check_usage_limit() RETURNS TRIGGER AS $$
        DECLARE
            queued_account_id INT;
        BEGIN
            -- Only trigger if usage meets/exceeds allocation AND account is currently active
            IF NEW.usage_for_field >= NEW.allocation_for_field AND NEW.is_active = TRUE THEN
                
                -- Look for a queued account for this specific field
                SELECT account_id INTO queued_account_id
                FROM field_accounts
                WHERE field_id = NEW.field_id AND is_queued = TRUE
                LIMIT 1;

                IF FOUND THEN
                    -- Deactivate the current full account
                    UPDATE field_accounts 
                    SET is_active = FALSE 
                    WHERE field_id = NEW.field_id AND account_id = NEW.account_id;
                    
                    -- Activate the queued account and remove it from queue
                    UPDATE field_accounts 
                    SET is_active = TRUE, is_queued = FALSE
                    WHERE field_id = NEW.field_id AND account_id = queued_account_id;
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
    `);
}

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
        
        // Initialize schema on first connect
        await initSchema(dbClient);
        console.log("Schema check complete.");

    } catch (err) {
        console.error("Error connecting or initializing schema:", err);
        throw err;
    }

    return dbClient;
}

exports.handler = async (event) => {
    console.log("Lambda Handler Event:", JSON.stringify(event));

    // Common Headers for CORS
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
    };

    // Handling CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: "CORS preflight check passed" })
        };
    }

    // SAFETY CHECK: Ensure we are receiving a Proxy Event
    if (!event.httpMethod) {
        console.error("Error: Lambda was invoked with raw data, not a Proxy Event.");
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                message: "Configuration Error: 'Use Lambda Proxy integration' is disabled in API Gateway. Please go to API Gateway -> [Method] -> Integration Request -> Check 'Use Lambda Proxy integration' -> Save -> Deploy API."
            })
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

    // Merge CORS headers with content type
    const headers = {
        ...corsHeaders,
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
        // --- ADMIN: RESET & SEED DB ---
        if (path === '/admin/reset-db' && httpMethod === 'POST') {
            console.log("RESETTING DATABASE...");
            
            // 1. DROP ALL TABLES & TYPES (Aggressive Cleanup)
            // We run these individually to ensure no lingering locks or dependency issues block the reset.
            await queryDb("DROP TRIGGER IF EXISTS trigger_check_usage_limit ON field_accounts");
            await queryDb("DROP FUNCTION IF EXISTS check_usage_limit");
            await queryDb("DROP VIEW IF EXISTS water_bank_view CASCADE");
            await queryDb("DROP TABLE IF EXISTS water_bank CASCADE");
            await queryDb("DROP TABLE IF EXISTS field_accounts CASCADE");
            await queryDb("DROP TABLE IF EXISTS water_orders CASCADE");
            await queryDb("DROP TABLE IF EXISTS accounts CASCADE");
            await queryDb("DROP TABLE IF EXISTS fields CASCADE");
            
            // Drop the specific ENUM type that was causing the error
            await queryDb("DROP TYPE IF EXISTS water_order_status CASCADE");
            
            console.log("Database cleared. Re-initializing schema...");

            // 2. RECREATE SCHEMA
            await initSchema(client);
            
            // 3. INSERT SEED DATA
            
            // Insert Fields
            await queryDb(`
                INSERT INTO fields (id, name, crop, acres, location, total_water_allocation, water_used, owner, "lateral", tap_number) VALUES 
                ('F001', 'North Field 1', 'Alfalfa', 120, '43.6150° N, 116.2023° W', 480.0, 150.0, 'Provost Farms', 'A', 'A-12'),
                ('F002', 'South Field 2', 'Corn', 80, '43.6180° N, 116.2050° W', 320.0, 100.0, 'Provost Farms', 'A', 'A-14'),
                ('F003', 'East Ridge', 'Sugar Beets', 150, '43.6200° N, 116.2100° W', 600.0, 450.0, 'Miller Land Co', 'B', 'B-05'),
                ('F004', 'West Valley', 'Potatoes', 100, '43.6220° N, 116.2150° W', 400.0, 180.0, 'Miller Land Co', 'B', 'B-08')
            `);
            
            // Insert Accounts
            await queryDb(`
                INSERT INTO accounts (account_number, owner_name, total_allocation) VALUES 
                ('ACC-PROV-01', 'Provost Farms', 1000.0),
                ('ACC-PROV-02', 'Provost Farms (Secondary)', 500.0),
                ('ACC-MILL-01', 'Miller Land Co', 1500.0)
            `);
            
            // Link Fields & Accounts
            await queryDb(`
                INSERT INTO field_accounts (field_id, account_id, allocation_for_field, usage_for_field, is_active)
                SELECT 'F001', id, 480.0, 150.0, TRUE FROM accounts WHERE account_number = 'ACC-PROV-01'
            `);
            await queryDb(`
                INSERT INTO field_accounts (field_id, account_id, allocation_for_field, usage_for_field, is_active)
                SELECT 'F001', id, 480.0, 0.0, FALSE FROM accounts WHERE account_number = 'ACC-PROV-02'
            `);
            await queryDb(`
                INSERT INTO field_accounts (field_id, account_id, allocation_for_field, usage_for_field, is_active)
                SELECT 'F002', id, 320.0, 100.0, TRUE FROM accounts WHERE account_number = 'ACC-PROV-01'
            `);
            // Trigger Alert on F003
            await queryDb(`
                INSERT INTO field_accounts (field_id, account_id, allocation_for_field, usage_for_field, is_active)
                SELECT 'F003', id, 600.0, 450.0, TRUE FROM accounts WHERE account_number = 'ACC-MILL-01'
            `);
            await queryDb(`
                INSERT INTO field_accounts (field_id, account_id, allocation_for_field, usage_for_field, is_active)
                SELECT 'F004', id, 400.0, 180.0, TRUE FROM accounts WHERE account_number = 'ACC-MILL-01'
            `);
            
            // Insert Water Bank
            await queryDb(`
                INSERT INTO water_bank (account_id, "lateral", amount_available, source, field_association)
                SELECT id, 'B', 200.0, 'Saved Allocation', 'East Ridge' FROM accounts WHERE account_number = 'ACC-MILL-01'
            `);
            
             // Insert Sample Orders
             const now = new Date();
             const dayAgo = new Date(now.getTime() - 86400000).toISOString();
             const tenDaysAgo = new Date(now.getTime() - 864000000).toISOString();
             
             // IMPORTANT: Using "In Progress" (with space) to match Frontend Types
             await queryDb(`
                INSERT INTO water_orders (id, field_id, field_name, requester, status, order_date, requested_amount, "lateral", delivery_start_date)
                VALUES
                ('ORD-101', 'F001', 'North Field 1', 'Mike Beus', 'Completed', '${tenDaysAgo}', 24.0, 'A', '${tenDaysAgo}'),
                ('ORD-102', 'F003', 'East Ridge', 'Mike Beus', 'In Progress', '${dayAgo}', 36.0, 'B', '${dayAgo}')
            `);

            return { statusCode: 200, headers, body: JSON.stringify({ message: "Database Reset and Seeded Successfully" }) };
        }

        // --- WATER ORDER ENDPOINTS ---
        if (path === '/orders' && httpMethod === 'GET') {
            const res = await queryDb("SELECT * FROM water_orders ORDER BY order_date DESC");
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

        // Safe path matching
        if (path && path.match(/^\/orders\/[a-zA-Z0-9-]+$/) && httpMethod === 'PUT') {
            const orderId = path.split('/').pop();
            console.log(`Updating order ${orderId}. Body:`, body);
            const data = JSON.parse(body);
            
            await queryDb(
                `UPDATE water_orders SET status = $1 WHERE id = $2`,
                [data.status, orderId]
            );

            // If order completed, update water_used in fields table & field_accounts table
            if (data.status === 'Completed') {
                console.log("Order completed. Updating usage stats.");
                const orderRes = await queryDb("SELECT field_id, requested_amount FROM water_orders WHERE id = $1", [orderId]);
                if(orderRes.rows.length > 0) {
                    const { field_id, requested_amount } = orderRes.rows[0];
                    const amount = parseFloat(requested_amount);
                    
                    await queryDb("UPDATE fields SET water_used = COALESCE(water_used, 0) + $1 WHERE id = $2", [amount, field_id]);
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
            const fieldsRes = await queryDb("SELECT * FROM fields ORDER BY name ASC");
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
        if (path && path.match(/^\/fields\/[a-zA-Z0-9-]+\/accounts$/) && httpMethod === 'PUT') {
            const fieldId = path.split('/')[2];
            console.log(`Updating account queue for field ${fieldId}. Body:`, body);
            const { nextAccountId } = JSON.parse(body);

            await queryDb("UPDATE field_accounts SET is_queued = FALSE WHERE field_id = $1", [fieldId]);
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
