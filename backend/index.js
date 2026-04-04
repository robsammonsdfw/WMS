const pg = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

let pool = null;
let schemaDone = false;

const JWT_SECRET = process.env.JWT_SECRET || "development-fallback-secret-key";

async function initSchema(client) {
    if (schemaDone) return;
    
    const queries = [
        `CREATE TABLE IF NOT EXISTS users (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, role VARCHAR(50) DEFAULT 'farmer', created_at TIMESTAMP DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS laterals (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255) NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS headgates (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255) NOT NULL, lateral_id VARCHAR(255) REFERENCES laterals(id), tap_number VARCHAR(50))`,
        `CREATE TABLE IF NOT EXISTS accounts (account_number VARCHAR(255) PRIMARY KEY, owner_name VARCHAR(255), total_allotment NUMERIC DEFAULT 0, total_allowance NUMERIC DEFAULT 0, user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE)`,
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
            primary_account_number VARCHAR(255),
            user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE
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
            account_number VARCHAR(255),
            user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS account_alerts (
            id VARCHAR(255) PRIMARY KEY,
            account_number VARCHAR(255),
            alert_type VARCHAR(50),
            threshold_percent NUMERIC,
            is_acknowledged BOOLEAN DEFAULT FALSE,
            user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE
        )`
    ];

    for (const q of queries) {
        await client.query(q);
    }
    
    // Failsafe: Add new columns if they don't exist yet
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(255)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`);
    
    // Auto-patch existing databases with the new allowance column
    await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS total_allowance NUMERIC DEFAULT 0`);
    
    schemaDone = true;
}

async function getPool() {
    if (!pool) {
        const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;
        if (!DB_HOST || !DB_PASSWORD) throw new Error("DB Connection Details Missing");
        
        pool = new pg.Pool({ 
            host: DB_HOST, 
            port: DB_PORT || 5432, 
            user: DB_USER, 
            password: DB_PASSWORD, 
            database: DB_NAME, 
            ssl: { rejectUnauthorized: false }, 
            connectionTimeoutMillis: 5000,
            max: 5 
        });
    }
    return pool;
}

exports.handler = async (e) => {
    const resHeaders = { 
        "Access-Control-Allow-Origin": "*", 
        "Access-Control-Allow-Headers": "Content-Type,X-Api-Key,Authorization,Accept", 
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS", 
        "Content-Type": "application/json" 
    };

    if (!e.httpMethod && !e.requestContext && Object.keys(e).length === 0) {
        return { statusCode: 200, headers: resHeaders, body: '' };
    }

    const method = e.httpMethod || "GET";

    if (method === 'OPTIONS') {
        return { statusCode: 200, headers: resHeaders, body: '' };
    }
    
    let path = e.path || "/";
    path = path.replace(/^\/(v1|prod|dev|v2)/, ""); 
    path = path.split('?')[0]; 
    path = path.replace(/\/$/, ""); 
    if (path === "") path = "/";

    const isAuthRoute = path === '/auth/login' || path === '/auth/signup';
    let currentUser = null;

    if (method !== 'OPTIONS' && !isAuthRoute) {
        const authHeader = e.headers?.authorization || e.headers?.Authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { statusCode: 401, headers: resHeaders, body: JSON.stringify({ msg: "Unauthorized: Missing token" }) };
        }

        const token = authHeader.split(' ')[1];
        try {
            currentUser = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return { statusCode: 401, headers: resHeaders, body: JSON.stringify({ msg: "Unauthorized: Invalid or expired token" }) };
        }
    }

    let client;
    try {
        const dbPool = await getPool();
        client = await dbPool.connect();

        await initSchema(client);

        const body = e.body ? JSON.parse(e.body) : {};

        if (path === '/auth/signup' && method === 'POST') {
            const { name, email, password, role } = body;
            if (!email || !password) return { statusCode: 400, headers: resHeaders, body: JSON.stringify({ msg: "Email and password required" }) };

            const existing = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
            if (existing.rows.length > 0) return { statusCode: 400, headers: resHeaders, body: JSON.stringify({ msg: "Email already in use" }) };

            const userId = 'USR-' + Math.random().toString(36).substr(2, 9).toUpperCase();
            const hashedPw = bcrypt.hashSync(password, 10);
            const userRole = role || 'farmer';

            await client.query(
                'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
                [userId, name, email.toLowerCase(), hashedPw, userRole]
            );

            const token = jwt.sign({ userId, role: userRole }, JWT_SECRET, { expiresIn: '24h' });
            return { statusCode: 201, headers: resHeaders, body: JSON.stringify({ token, user: { id: userId, name, email, role: userRole } }) };
        }

        if (path === '/auth/login' && method === 'POST') {
            const { email, password } = body;
            if (!email || !password) return { statusCode: 400, headers: resHeaders, body: JSON.stringify({ msg: "Email and password required" }) };

            const result = await client.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
            if (result.rows.length === 0) return { statusCode: 401, headers: resHeaders, body: JSON.stringify({ msg: "Invalid credentials" }) };

            const user = result.rows[0];
            const isValid = bcrypt.compareSync(password, user.password_hash);
            if (!isValid) return { statusCode: 401, headers: resHeaders, body: JSON.stringify({ msg: "Invalid credentials" }) };

            const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, city: user.city, phone: user.phone } }) };
        }

        if (path === '/users') {
            if (method === 'GET') {
                const r = await client.query(`SELECT id, name, email, role, city, phone, created_at FROM users ORDER BY created_at DESC`);
                return { statusCode: 200, headers: resHeaders, body: JSON.stringify(r.rows) };
            }
            if (method === 'POST') {
                const { name, email, password, role } = body;
                if (!email || !password) return { statusCode: 400, headers: resHeaders, body: JSON.stringify({ msg: "Email and password required" }) };

                const existing = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
                if (existing.rows.length > 0) return { statusCode: 400, headers: resHeaders, body: JSON.stringify({ msg: "Email already in use" }) };

                const userId = 'USR-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                const hashedPw = bcrypt.hashSync(password, 10);
                const userRole = role || 'farmer';

                await client.query(
                    'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
                    [userId, name, email.toLowerCase(), hashedPw, userRole]
                );
                return { statusCode: 201, headers: resHeaders, body: JSON.stringify({ id: userId, name, email, role: userRole }) };
            }
        }

        if (path.match(/^\/users\/[^/]+$/)) {
            const uId = path.split('/').pop();
            if (method === 'PUT') {
                const { name, email, role, city, phone } = body;
                await client.query(
                    `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role), city = COALESCE($4, city), phone = COALESCE($5, phone) WHERE id = $6`,
                    [name, email?.toLowerCase(), role, city, phone, uId]
                );
                return { statusCode: 200, headers: resHeaders, body: JSON.stringify({ success: true }) };
            }
            if (method === 'DELETE') {
                await client.query(`DELETE FROM users WHERE id = $1`, [uId]);
                return { statusCode: 200, headers: resHeaders, body: JSON.stringify({ success: true }) };
            }
        }

        // --- SILOED ACCOUNTS ---
        if (path === '/accounts') {
            if (method === 'GET') {
                const r = await client.query(`SELECT * FROM accounts WHERE user_id = $1 ORDER BY account_number ASC`, [currentUser.userId]);
                return { statusCode: 200, headers: resHeaders, body: JSON.stringify(r.rows) };
            }
            if (method === 'POST') {
                await client.query(
                    `INSERT INTO accounts (account_number, owner_name, total_allotment, total_allowance, user_id) VALUES ($1, $2, $3, $4, $5) 
                     ON CONFLICT (account_number) DO UPDATE SET owner_name = EXCLUDED.owner_name, total_allotment = EXCLUDED.total_allotment, total_allowance = EXCLUDED.total_allowance
                     WHERE accounts.user_id = EXCLUDED.user_id`, 
                    [body.accountNumber, body.ownerName, body.totalAllotment, body.totalAllowance, currentUser.userId]
                );
                return { statusCode: 201, headers: resHeaders, body: JSON.stringify({ success: true }) };
            }
        }

        if (path.match(/^\/accounts\/[^/]+$/) && method === 'DELETE') {
            const accNum = path.split('/').pop();
            await client.query(`DELETE FROM accounts WHERE account_number = $1 AND user_id = $2`, [accNum, currentUser.userId]);
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify({success: true}) };
        }

        // --- SILOED ALERTS ---
        if (path === '/alerts') {
            if (method === 'GET') {
                const r = await client.query(`SELECT * FROM account_alerts WHERE user_id = $1`, [currentUser.userId]);
                return { statusCode: 200, headers: resHeaders, body: JSON.stringify(r.rows) };
            }
            if (method === 'POST') {
                const alerts = Array.isArray(body) ? body : [body];
                await client.query('BEGIN');
                try {
                    for (const alert of alerts) {
                        const id = alert.id || 'ALT-' + Math.random().toString(36).substr(2, 5).toUpperCase();
                        await client.query(
                            `INSERT INTO account_alerts (id, account_number, alert_type, threshold_percent, is_acknowledged, user_id) 
                             VALUES ($1, $2, $3, $4, false, $5) 
                             ON CONFLICT (id) DO UPDATE SET alert_type = EXCLUDED.alert_type, threshold_percent = EXCLUDED.threshold_percent, is_acknowledged = false 
                             WHERE account_alerts.user_id = EXCLUDED.user_id`,
                            [id, alert.accountNumber, alert.alertType, alert.thresholdPercent, currentUser.userId]
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
            await client.query(`UPDATE account_alerts SET is_acknowledged = COALESCE($1, is_acknowledged) WHERE id = $2 AND user_id = $3`, [body.isAcknowledged, alertId, currentUser.userId]);
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify({success: true}) };
        }

        if (path.match(/^\/alerts\/[^/]+$/) && method === 'DELETE') {
            const alertId = path.split('/').pop();
            await client.query(`DELETE FROM account_alerts WHERE id = $1 AND user_id = $2`, [alertId, currentUser.userId]);
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify({success: true}) };
        }

        // --- SILOED FIELDS ---
        if (path === '/fields') {
            if (method === 'GET') {
                const r = await client.query(`
                    SELECT f.*, 
                    array_remove(array_agg(DISTINCT fh.headgate_id), NULL) as hg_ids 
                    FROM fields f 
                    LEFT JOIN field_headgates fh ON f.id = fh.field_id 
                    WHERE f.user_id = $1
                    GROUP BY f.id
                `, [currentUser.userId]);
                return { statusCode: 200, headers: resHeaders, body: JSON.stringify(r.rows.map(row => ({...row, headgateIds: row.hg_ids || []}))) };
            }
            if (method === 'POST') {
                await client.query('BEGIN');
                try {
                    await client.query(
                        `INSERT INTO fields (id, name, company_name, address, phone, crop, acres, total_water_allocation, water_allotment, lat, lng, owner, "lateral", tap_number, primary_account_number, user_id) 
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) 
                         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, company_name=EXCLUDED.company_name, address=EXCLUDED.address, phone=EXCLUDED.phone, crop=EXCLUDED.crop, acres=EXCLUDED.acres, total_water_allocation=EXCLUDED.total_water_allocation, water_allotment=EXCLUDED.water_allotment, lat=EXCLUDED.lat, lng=EXCLUDED.lng, owner=EXCLUDED.owner, "lateral"=EXCLUDED."lateral", tap_number=EXCLUDED.tap_number, primary_account_number=EXCLUDED.primary_account_number 
                         WHERE fields.user_id = EXCLUDED.user_id`, 
                        [body.id, body.name, body.companyName, body.address, body.phone, body.crop, body.acres, body.totalWaterAllocation, body.waterAllotment, body.lat, body.lng, body.owner, body.lateral, body.tapNumber, body.primaryAccountNumber, currentUser.userId]
                    );
                    
                    const ownershipCheck = await client.query(`SELECT id FROM fields WHERE id = $1 AND user_id = $2`, [body.id, currentUser.userId]);
                    if (ownershipCheck.rows.length > 0 && body.headgateIds && Array.isArray(body.headgateIds)) {
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
            const ownershipCheck = await client.query(`SELECT id FROM fields WHERE id = $1 AND user_id = $2`, [fieldId, currentUser.userId]);
            if (ownershipCheck.rows.length === 0) return { statusCode: 403, headers: resHeaders, body: JSON.stringify({ msg: "Forbidden: Field not found or access denied" }) };

            await client.query(`DELETE FROM water_orders WHERE field_id = $1 AND user_id = $2`, [fieldId, currentUser.userId]);
            await client.query(`DELETE FROM field_headgates WHERE field_id = $1`, [fieldId]);
            const r = await client.query(`DELETE FROM fields WHERE id = $1 AND user_id = $2`, [fieldId, currentUser.userId]);
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify({success: r.rowCount > 0}) };
        }

        // --- SYSTEM-WIDE INFRASTRUCTURE (Shared by all users) ---
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

        // --- SILOED ORDERS ---
        if (path === '/orders') {
            if (method === 'GET') {
                const r = await client.query(`SELECT * FROM water_orders WHERE user_id = $1 ORDER BY delivery_start_date ASC`, [currentUser.userId]);
                return { statusCode: 200, headers: resHeaders, body: JSON.stringify(r.rows) };
            }
            if (method === 'POST') {
                const id = 'ORD-' + Math.random().toString(36).substr(2, 5).toUpperCase();
                await client.query(
                    `INSERT INTO water_orders (id, field_id, field_name, requester, status, order_type, requested_amount, delivery_start_date, lateral_id, headgate_id, tap_number, delivery_end_date, account_number, user_id) 
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, 
                    [id, body.fieldId, body.fieldName, body.requester, body.status, body.orderType, body.requestedAmount, body.deliveryStartDate, body.lateralId||null, body.headgateId||null, body.tapNumber, body.deliveryEndDate || null, body.accountNumber || null, currentUser.userId]
                );
                return { statusCode: 201, headers: resHeaders, body: JSON.stringify({id}) };
            }
        }

        if (path.match(/^\/orders\/[^/]+$/)) {
            const oid = path.split('/').pop();
            
            if (method === 'PUT') {
                await client.query(
                    `UPDATE water_orders SET status = COALESCE($1, status), delivery_end_date = COALESCE($2, delivery_end_date), delivery_start_date = COALESCE($3, delivery_start_date), account_number = COALESCE($4, account_number) 
                     WHERE id = $5 AND user_id = $6`, 
                    [body.status, body.deliveryEndDate, body.deliveryStartDate, body.accountNumber, oid, currentUser.userId]
                );
                return { statusCode: 200, headers: resHeaders, body: JSON.stringify({success: true}) };
            }
            
            if (method === 'DELETE') {
                await client.query(`DELETE FROM water_orders WHERE id = $1 AND user_id = $2`, [oid, currentUser.userId]);
                return { statusCode: 200, headers: resHeaders, body: JSON.stringify({success: true}) };
            }
        }

        if (path === '/admin/reset-db' && method === 'POST') {
            if (currentUser.role !== 'superuser') {
                return { statusCode: 403, headers: resHeaders, body: JSON.stringify({ msg: "Forbidden: You do not have permission to reset the database." }) };
            }
            await client.query(`DROP TABLE IF EXISTS account_alerts, field_headgates, water_orders, headgates, laterals, fields, accounts, users CASCADE`);
            schemaDone = false; 
            await initSchema(client);
            return { statusCode: 200, headers: resHeaders, body: JSON.stringify({msg: "Reset Complete"}) };
        }

        return { statusCode: 404, headers: resHeaders, body: JSON.stringify({msg: `Not Found: ${path}`}) };

    } catch (err) {
        console.error(err);
        return { statusCode: 500, headers: resHeaders, body: JSON.stringify({msg: "Backend Error", error: err.message, stack: err.stack}) };
    } finally {
        if (client) {
            client.release();
        }
    }
};