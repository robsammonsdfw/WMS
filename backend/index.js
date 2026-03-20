const pg = require("pg");
let dbClient = null;
let schemaDone = false;

async function initSchema(client) {
    if (schemaDone) return;
    
    // Create base tables safely
    const queries = [
        `CREATE TABLE IF NOT EXISTS laterals (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255) NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS headgates (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255) NOT NULL, lateral_id VARCHAR(255) REFERENCES laterals(id), tap_number VARCHAR(50))`,
        `CREATE TABLE IF NOT EXISTS accounts (account_number VARCHAR(255) PRIMARY KEY, owner_name VARCHAR(255), total_allotment NUMERIC DEFAULT 0)`,
        `CREATE TABLE IF NOT EXISTS fields (
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
            "lateral" VARCHAR(255), 
            tap_number VARCHAR(255),
            primary_account_number VARCHAR(255)
        )`,
        `CREATE TABLE IF NOT EXISTS field_headgates (field_id VARCHAR(255) REFERENCES fields(id) ON DELETE CASCADE, headgate_id VARCHAR(255) REFERENCES headgates(id) ON DELETE CASCADE, PRIMARY KEY (field_id, headgate_id))`,
        `CREATE TABLE IF NOT EXISTS water_orders (
            id VARCHAR(255) PRIMARY KEY, 
            field_id VARCHAR(255) REFERENCES fields(id), 
            field_name VARCHAR(255), 
            requester VARCHAR(255), 
            status VARCHAR(50), 
            order_type VARCHAR(50), 
            order_date TIMESTAMP DEFAULT NOW(), 
            requested_amount NUMERIC, 
            delivery_start_date DATE, 
            delivery_end_date DATE,
            lateral_id VARCHAR(255), 
            headgate_id VARCHAR(255), 
            tap_number VARCHAR(50),
            account_number VARCHAR(255)
        )`,
        `CREATE TABLE IF NOT EXISTS account_alerts (
            id VARCHAR(255) PRIMARY KEY,
            account_number VARCHAR(255),
            alert_type VARCHAR(50),
            threshold_percent NUMERIC,
            is_acknowledged BOOLEAN DEFAULT FALSE
        )`
    ];

    for (const q of queries) {
        await client.query(q);
    }

    // Migration steps - run loosely
    try {
        await client.query(`ALTER TABLE water_orders ADD COLUMN IF NOT EXISTS delivery_end_date DATE`);
        await client.query(`ALTER TABLE water_orders ADD COLUMN IF NOT EXISTS account_number VARCHAR(255)`);
        await client.query(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS primary_account_number VARCHAR(255)`);
        await client.query(`ALTER TABLE water_orders DROP CONSTRAINT IF EXISTS water_orders_lateral_id_fkey`);
        await client.query(`ALTER TABLE water_orders DROP CONSTRAINT IF EXISTS water_orders_headgate_id_fkey`);
    } catch (e) {
        console.log("Migration warning:", e.message);
    }

    schemaDone = true;
}

async function getClient() {
    if (dbClient) {
        try { await dbClient.query('SELECT 1'); return dbClient; } 
        catch (e) { dbClient = null; }
    }
    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;
    if (!DB_HOST || !DB_PASSWORD) throw new Error("DB Connection Details Missing");
    
    const client = new pg.Client({ 
        host: DB_HOST, 
        port: DB_PORT || 5432, 
        user: DB_USER, 
        password: DB_PASSWORD, 
        database: DB_NAME, 
        ssl: { rejectUnauthorized: false }, 
        connectionTimeoutMillis: 5000 
    });
    
    await client.connect();
    await initSchema(client);
    dbClient = client;
    return client;
}

exports.handler = async (e) => {
    const resHeaders = { 
        "Access-Control-Allow-Origin": "*", 
        "Access-Control-Allow-Headers": "Content-Type,X-Api-Key,x-api-key", 
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS", 
        "Content-Type": "application/json" 
    };
    
    if (e.httpMethod === 'OPTIONS') return { statusCode: 200, headers: resHeaders, body: '' };
    
    // Robust path parsing
    let path = (e.rawPath || e.path || "/");
    path = path.replace(/^\/(v1|prod|dev|v2)/, ""); 
    path = path.split('?')[0]; 
    path = path.replace(/\/$/, ""); 
    if (path === "") path = "/";

    const method = e.httpMethod || (e.requestContext && e.requestContext.http ? e.requestContext.http.method : "GET");
    
    try {
        const client = await getClient();
        const body = e.body ? JSON.parse(e.body) : {};

        // --- ACCOUNTS ---
        if (path === '/accounts') {
            if (method === 'GET') {
                const r = await client.query(`SELECT * FROM accounts ORDER BY account_number ASC`);
                return { statusCode: 200, headers: resHeaders, body: JSON.stringify(r.rows) };
            }
            if (method === 'POST') {
                await client.query(`INSERT INTO accounts (account_number, owner_name, total_allotment) VALUES ($1, $2, $3) ON CONFLICT (account_number) DO UPDATE SET owner_name = EXCLUDED.owner_name, total_allotment = EXCLUDED.total_allotment`, 
                [body.accountNumber, body.ownerName, body.totalAllotment]);
                return { statusCode: 201, headers: resHeaders, body: JSON.stringify({ success: true }) };
            }
        }

        // --- ALERTS ---
        if (path === '/alerts') {
            if (method === 'GET') {
                const r = await client.query(`SELECT * FROM account_alerts`);
                return { statusCode: 200, headers: resHeaders, body: JSON.stringify(r.rows) };
            }
            if (method === 'POST') {
                const alerts = Array.isArray(body) ? body : [body];
                await client.query('BEGIN');
                try {
                    for (const alert of alerts) {
                        const id = alert.id || 'ALT-' + Math.random().toString(36).substr(2, 5).toUpperCase();
                        await client.query(
                            `INSERT INTO account_alerts (id, account_number, alert_type, threshold_percent, is_acknowledged) 
                             VALUES ($1, $2, $3, $4, false) 
                             ON CONFLICT (id) DO UPDATE SET alert_type = EXCLUDED.alert_type, threshold_percent = EXCLUDED.threshold_percent, is_acknowledged = false`,
                            [id, alert.accountNumber, alert.alertType, alert.thresholdPercent]
                        );
                    }
                    await client.query('COMMIT');
                    return { statusCode: 201, headers: resHeaders, body: JSON.stringify({ success: true }) };
                } catch (err) {
                    await client.query('ROLLBACK');
                    throw err;
                }
            }
        }

        if (path.match(/^\/alerts\/[^/]+$/) && method === 'PUT') {
            const alertId = path.split('/').pop();
            await client.query(`UPDATE account_alerts SET is_acknowledged = COALESCE($1, is_acknowledged) WHERE id = $2`, [body.isAcknowledledged, alertId]);
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify({success: true}) };
        }

        if (path.match(/^\/alerts\/[^/]+$/) && method === 'DELETE') {
            const alertId = path.split('/').pop();
            await client.query(`DELETE FROM account_alerts WHERE id = $1`, [alertId]);
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify({success: true}) };
        }

        // --- FIELDS ---
        if (path === '/fields') {
            if (method === 'GET') {
                const r = await client.query(`
                    SELECT f.*, 
                    array_remove(array_agg(DISTINCT fh.headgate_id), NULL) as hg_ids 
                    FROM fields f 
                    LEFT JOIN field_headgates fh ON f.id = fh.field_id 
                    GROUP BY f.id
                `);
                return { statusCode: 200, headers: resHeaders, body: JSON.stringify(r.rows.map(row => ({...row, headgateIds: row.hg_ids || []}))) };
            }
            if (method === 'POST') {
                await client.query('BEGIN');
                try {
                    // UPSERT Logic: If ID exists, UPDATE. If not, INSERT.
                    await client.query(`INSERT INTO fields (id, name, company_name, address, phone, crop, acres, total_water_allocation, water_allotment, lat, lng, owner, "lateral", tap_number, primary_account_number) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, $15) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, company_name=EXCLUDED.company_name, address=EXCLUDED.address, phone=EXCLUDED.phone, crop=EXCLUDED.crop, acres=EXCLUDED.acres, total_water_allocation=EXCLUDED.total_water_allocation, water_allotment=EXCLUDED.water_allotment, lat=EXCLUDED.lat, lng=EXCLUDED.lng, owner=EXCLUDED.owner, "lateral"=EXCLUDED."lateral", tap_number=EXCLUDED.tap_number, primary_account_number=EXCLUDED.primary_account_number`, 
                    [body.id, body.name, body.companyName, body.address, body.phone, body.crop, body.acres, body.totalWaterAllocation, body.waterAllotment, body.lat, body.lng, body.owner, body.lateral, body.tapNumber, body.primaryAccountNumber]);
                    
                    if (body.headgateIds && Array.isArray(body.headgateIds)) {
                        await client.query(`DELETE FROM field_headgates WHERE field_id = $1`, [body.id]);
                        for (const hgId of body.headgateIds) {
                            await client.query(`INSERT INTO field_headgates (field_id, headgate_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [body.id, hgId]);
                        }
                    }
                    await client.query('COMMIT');
                    return { statusCode: 201, headers: resHeaders, body: JSON.stringify({success: true}) };
                } catch (err) {
                    await client.query('ROLLBACK');
                    throw err;
                }
            }
        }

        if (path.match(/^\/fields\/[^/]+$/) && method === 'DELETE') {
            const fieldId = path.split('/').pop();
            await client.query(`DELETE FROM water_orders WHERE field_id = $1`, [fieldId]);
            await client.query(`DELETE FROM field_headgates WHERE field_id = $1`, [fieldId]);
            const r = await client.query(`DELETE FROM fields WHERE id = $1`, [fieldId]);
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify({success: r.rowCount > 0}) };
        }

        // --- LATERALS ---
        if (path === '/laterals') {
            if (method === 'GET') {
                const r = await client.query(`SELECT * FROM laterals`);
                return { statusCode: 200, headers: resHeaders, body: JSON.stringify(r.rows) };
            }
            if (method === 'POST') {
                await client.query(`INSERT INTO laterals (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`, [body.id, body.name]);
                return { statusCode: 201, headers: resHeaders, body: JSON.stringify({ success: true }) };
            }
        }

        // --- HEADGATES ---
        if (path === '/headgates') {
            if (method === 'GET') {
                const r = await client.query(`SELECT * FROM headgates`);
                return { statusCode: 200, headers: resHeaders, body: JSON.stringify(r.rows) };
            }
            if (method === 'POST') {
                await client.query(`INSERT INTO headgates (id, name, lateral_id, tap_number) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, lateral_id = EXCLUDED.lateral_id, tap_number = EXCLUDED.tap_number`, [body.id, body.name, body.lateralId, body.tapNumber]);
                return { statusCode: 201, headers: resHeaders, body: JSON.stringify({ success: true }) };
            }
        }

        // --- WATER BANK ---
        if (path === '/water-bank' && method === 'GET') {
            // Mock data for now
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify([
                { id: 'WB1', fieldAssociation: 'North Reservoir', amountAvailable: 150.5, lateral: 'Lateral 8.13' },
                { id: 'WB2', fieldAssociation: 'Community Pool', amountAvailable: 45.0, lateral: 'Lateral A' }
            ])};
        }

        if (path.match(/^\/fields\/[^/]+\/queue$/) && method === 'PUT') {
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify({ success: true }) };
        }

        // --- ORDERS ---
        if (path === '/orders') {
            if (method === 'GET') {
                const r = await client.query(`SELECT * FROM water_orders ORDER BY delivery_start_date ASC`);
                return { statusCode: 200, headers: resHeaders, body: JSON.stringify(r.rows) };
            }
            if (method === 'POST') {
                const id = 'ORD-' + Math.random().toString(36).substr(2, 5).toUpperCase();
                await client.query(`INSERT INTO water_orders (id, field_id, field_name, requester, status, order_type, requested_amount, delivery_start_date, lateral_id, headgate_id, tap_number, delivery_end_date, account_number) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, 
                [id, body.fieldId, body.fieldName, body.requester, body.status, body.orderType, body.requestedAmount, body.deliveryStartDate, body.lateralId||null, body.headgateId||null, body.tapNumber, body.deliveryEndDate || null, body.accountNumber || null]);
                return { statusCode: 201, headers: resHeaders, body: JSON.stringify({id}) };
            }
        }

        if (path.match(/^\/orders\/[^/]+$/) && method === 'PUT') {
            const oid = path.split('/').pop();
            await client.query(
                `UPDATE water_orders SET status = COALESCE($1, status), delivery_end_date = COALESCE($2, delivery_end_date), delivery_start_date = COALESCE($3, delivery_start_date), account_number = COALESCE($4, account_number) WHERE id = $5`, 
                [body.status, body.deliveryEndDate, body.deliveryStartDate, body.accountNumber, oid]
            );
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify({success: true}) };
        }

        // --- ADMIN ---
        if (path === '/admin/reset-db' && method === 'POST') {
            await client.query(`DROP TABLE IF EXISTS account_alerts, field_headgates, water_orders, headgates, laterals, fields, accounts CASCADE`);
            schemaDone = false; 
            await initSchema(client);
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify({msg: "Reset Complete"}) };
        }

        return { statusCode: 404, headers: resHeaders, body: JSON.stringify({msg: `Not Found: ${path}`}) };

    } catch (err) {
        console.error(err);
        return { statusCode: 500, headers: resHeaders, body: JSON.stringify({msg: "Backend Error", error: err.message, stack: err.stack}) };
    }
};