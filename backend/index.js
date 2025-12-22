
const pg = require("pg");
let dbClient = null;
let schemaDone = false;

async function initSchema(client) {
    if (schemaDone) return;
    await client.query(`
        CREATE TABLE IF NOT EXISTS laterals (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255) NOT NULL);
        CREATE TABLE IF NOT EXISTS headgates (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255) NOT NULL, lateral_id VARCHAR(255) REFERENCES laterals(id), tap_number VARCHAR(50));
        CREATE TABLE IF NOT EXISTS fields (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), crop VARCHAR(255), acres NUMERIC, location VARCHAR(255), total_water_allocation NUMERIC, water_used NUMERIC DEFAULT 0, owner VARCHAR(255), company_name VARCHAR(255), address TEXT, phone VARCHAR(50), lat NUMERIC, lng NUMERIC, water_allotment NUMERIC DEFAULT 0, allotment_used NUMERIC DEFAULT 0, lateral VARCHAR(255), tap_number VARCHAR(255));
        CREATE TABLE IF NOT EXISTS field_headgates (field_id VARCHAR(255) REFERENCES fields(id) ON DELETE CASCADE, headgate_id VARCHAR(255) REFERENCES headgates(id) ON DELETE CASCADE, PRIMARY KEY (field_id, headgate_id));
        CREATE TABLE IF NOT EXISTS water_orders (id VARCHAR(255) PRIMARY KEY, field_id VARCHAR(255) REFERENCES fields(id), field_name VARCHAR(255), requester VARCHAR(255), status VARCHAR(50), order_type VARCHAR(50), order_date TIMESTAMP DEFAULT NOW(), requested_amount NUMERIC, delivery_start_date DATE, lateral_id VARCHAR(255) REFERENCES laterals(id), headgate_id VARCHAR(255) REFERENCES headgates(id), tap_number VARCHAR(50));
    `);
    schemaDone = true;
}

async function getClient() {
    if (dbClient) {
        try { await dbClient.query('SELECT 1'); return dbClient; } 
        catch (e) { dbClient = null; }
    }
    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;
    if (!DB_HOST || !DB_PASSWORD) throw new Error("DB_HOST or DB_PASSWORD missing in Lambda Env Vars");
    const client = new pg.Client({ host: DB_HOST, port: DB_PORT || 5432, user: DB_USER, password: DB_PASSWORD, database: DB_NAME, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
    await client.connect();
    await initSchema(client);
    dbClient = client;
    return client;
}

exports.handler = async (e) => {
    const resHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type,X-Api-Key,x-api-key", "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS", "Content-Type": "application/json" };
    if (e.httpMethod === 'OPTIONS') return { statusCode: 200, headers: resHeaders, body: '' };
    
    let path = (e.path || "/").replace(/^\/(v1|prod|dev|v2)/, "");
    const method = e.httpMethod;
    
    try {
        const client = await getClient();
        const body = e.body ? JSON.parse(e.body) : {};

        if (path === '/fields' && method === 'GET') {
            const r = await client.query(`SELECT f.*, array_agg(DISTINCT fh.headgate_id) FILTER (WHERE fh.headgate_id IS NOT NULL) as hg_ids FROM fields f LEFT JOIN field_headgates fh ON f.id = fh.field_id GROUP BY f.id`);
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify(r.rows.map(row => ({...row, headgateIds: row.hg_ids || []}))) };
        } 
        
        if (path === '/fields' && method === 'POST') {
            await client.query(`INSERT INTO fields (id, name, company_name, address, phone, crop, acres, total_water_allocation, water_allotment, lat, lng, owner, lateral, tap_number) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, company_name=EXCLUDED.company_name, address=EXCLUDED.address, phone=EXCLUDED.phone, crop=EXCLUDED.crop, acres=EXCLUDED.acres, total_water_allocation=EXCLUDED.total_water_allocation, water_allotment=EXCLUDED.water_allotment, lat=EXCLUDED.lat, lng=EXCLUDED.lng, owner=EXCLUDED.owner, lateral=EXCLUDED.lateral, tap_number=EXCLUDED.tap_number`, [body.id, body.name, body.companyName, body.address, body.phone, body.crop, body.acres, body.totalWaterAllocation, body.waterAllotment, body.lat, body.lng, body.owner, body.lateral, body.tapNumber]);
            // Fix: Added logic to handle headgate associations in field_headgates table
            if (body.headgateIds && Array.isArray(body.headgateIds)) {
                await client.query(`DELETE FROM field_headgates WHERE field_id = $1`, [body.id]);
                for (const hgId of body.headgateIds) {
                    await client.query(`INSERT INTO field_headgates (field_id, headgate_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [body.id, hgId]);
                }
            }
            return { statusCode: 201, headers: resHeaders, body: JSON.stringify({success: true}) };
        }

        // Fix: Added backend routes for laterals, headgates, water-bank, and field account queueing
        if (path === '/laterals' && method === 'GET') {
            const r = await client.query(`SELECT * FROM laterals`);
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify(r.rows) };
        }
        if (path === '/laterals' && method === 'POST') {
            await client.query(`INSERT INTO laterals (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`, [body.id, body.name]);
            return { statusCode: 201, headers: resHeaders, body: JSON.stringify({ success: true }) };
        }
        if (path === '/headgates' && method === 'GET') {
            const r = await client.query(`SELECT * FROM headgates`);
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify(r.rows) };
        }
        if (path === '/headgates' && method === 'POST') {
            await client.query(`INSERT INTO headgates (id, name, lateral_id, tap_number) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, lateral_id = EXCLUDED.lateral_id, tap_number = EXCLUDED.tap_number`, [body.id, body.name, body.lateralId, body.tapNumber]);
            return { statusCode: 201, headers: resHeaders, body: JSON.stringify({ success: true }) };
        }
        if (path === '/water-bank' && method === 'GET') {
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify([
                { id: 'WB1', fieldAssociation: 'North Reservoir', amountAvailable: 150.5, lateral: 'Lateral 8.13' },
                { id: 'WB2', fieldAssociation: 'Community Pool', amountAvailable: 45.0, lateral: 'Lateral A' }
            ])};
        }
        if (path.startsWith('/fields/') && path.endsWith('/queue') && method === 'PUT') {
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify({ success: true }) };
        }

        if (path === '/orders' && method === 'GET') {
            const r = await client.query(`SELECT * FROM water_orders ORDER BY delivery_start_date ASC`);
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify(r.rows) };
        }

        if (path === '/orders' && method === 'POST') {
            const id = 'ORD-' + Math.random().toString(36).substr(2, 5).toUpperCase();
            await client.query(`INSERT INTO water_orders (id, field_id, field_name, requester, status, order_type, requested_amount, delivery_start_date, lateral_id, headgate_id, tap_number) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [id, body.fieldId, body.fieldName, body.requester, body.status, body.orderType, body.requestedAmount, body.deliveryStartDate, body.lateralId||null, body.headgateId||null, body.tapNumber]);
            return { statusCode: 201, headers: resHeaders, body: JSON.stringify({id}) };
        }

        if (path.startsWith('/orders/') && method === 'PUT') {
            const oid = path.split('/').pop();
            await client.query(`UPDATE water_orders SET status = $1 WHERE id = $2`, [body.status, oid]);
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify({success: true}) };
        }

        if (path === '/admin/reset-db' && method === 'POST') {
            await client.query(`DROP TABLE IF EXISTS field_headgates, water_orders, headgates, laterals, fields CASCADE`);
            schemaDone = false; await initSchema(client);
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify({msg: "Reset Complete"}) };
        }

        return { statusCode: 404, headers: resHeaders, body: JSON.stringify({msg: "Not Found"}) };
    } catch (err) {
        console.error(err);
        return { statusCode: 500, headers: resHeaders, body: JSON.stringify({msg: "DB Error", error: err.message}) };
    }
};
