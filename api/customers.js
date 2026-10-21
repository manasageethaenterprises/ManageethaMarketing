const { getDb } = require('../lib/db');

function formatIndiaPhone(phone) {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length === 10) {
        return '91' + digits;
    } else if (digits.length > 10) {
        return '91' + digits.slice(-10);
    }
    return digits;
}

module.exports = async (req, res) => {
    const sql = getDb();

    try {
        await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_saved BOOLEAN DEFAULT true;`;
        await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Open - Not Contacted';`;
    } catch(e) {
        // Table/column might already exist
    }

    if (req.method === 'GET') {
        try {
            const customers = await sql`
                SELECT c.*, 
                       COALESCE(c.status, 'Open - Not Contacted') as status,
                       (SELECT COUNT(*) FROM messages m WHERE m.customer_id = c.id) as message_count,
                       (SELECT COUNT(*) FROM messages m WHERE m.customer_id = c.id AND m.direction = 'inbound' AND m.status = 'delivered') as unread_count,
                       (SELECT MAX(created_at) FROM messages m WHERE m.customer_id = c.id AND m.direction = 'inbound') as last_inbound_at,
                       (SELECT MAX(created_at) FROM messages m WHERE m.customer_id = c.id) as last_message_at,
                       (SELECT content FROM messages m WHERE m.customer_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_content,
                       (SELECT direction FROM messages m WHERE m.customer_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_direction,
                       (SELECT COUNT(*) FROM messages m WHERE m.customer_id = c.id AND m.direction = 'inbound') as inbound_count,
                       (SELECT COUNT(*) FROM messages m WHERE m.customer_id = c.id AND m.direction = 'outbound') as outbound_count,
                       (SELECT m.direction FROM messages m WHERE m.customer_id = c.id ORDER BY m.created_at ASC LIMIT 1) as first_message_direction
                FROM customers c 
                ORDER BY COALESCE((SELECT MAX(created_at) FROM messages m WHERE m.customer_id = c.id), c.created_at) DESC
            `;
            return res.status(200).json(customers);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    } 

    if (req.method === 'PATCH') {
        try {
            const { id, status, name, phone } = req.body;
            if (!id) return res.status(400).json({ error: 'Customer ID required' });

            let result;
            if (status && name && phone) {
                const cleanPhone = formatIndiaPhone(phone);
                result = await sql`
                    UPDATE customers 
                    SET status = ${status}, name = ${name}, phone = ${cleanPhone}
                    WHERE id = ${id}
                    RETURNING *
                `;
            } else if (status) {
                result = await sql`
                    UPDATE customers 
                    SET status = ${status}
                    WHERE id = ${id}
                    RETURNING *
                `;
            } else if (name || phone) {
                const cleanPhone = phone ? formatIndiaPhone(phone) : undefined;
                result = await sql`
                    UPDATE customers 
                    SET name = COALESCE(${name}, name),
                        phone = COALESCE(${cleanPhone}, phone)
                    WHERE id = ${id}
                    RETURNING *
                `;
            }

            if (!result || result.length === 0) {
                return res.status(404).json({ error: 'Customer not found' });
            }

            return res.status(200).json({ success: true, customer: result[0] });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    
    if (req.method === 'POST') {
        try {
            const { id, name, phone, status } = req.body;
            if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });
            
            // Clean & format phone number (91 + 10 digits, handling double 91)
            const cleanPhone = formatIndiaPhone(phone);
            const custStatus = status || 'Open - Not Contacted';

            if (id) {
                const result = await sql`
                    UPDATE customers 
                    SET name = ${name}, phone = ${cleanPhone}, status = COALESCE(${status}, status)
                    WHERE id = ${id}
                    RETURNING *
                `;
                return res.status(200).json({ success: true, customer: result[0] });
            }
            
            const result = await sql`
                INSERT INTO customers (name, phone, is_saved, status) 
                VALUES (${name}, ${cleanPhone}, true, ${custStatus}) 
                ON CONFLICT (phone) DO UPDATE SET 
                    name = EXCLUDED.name, 
                    is_saved = true,
                    status = COALESCE(customers.status, EXCLUDED.status)
                RETURNING *
            `;
            return res.status(200).json({ success: true, customer: result[0] });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    if (req.method === 'DELETE') {
        try {
            const { id } = req.query;
            if (!id) return res.status(400).json({ error: 'Customer ID required' });
            
            // Delete messages first
            await sql`DELETE FROM messages WHERE customer_id = ${id}`;
            await sql`DELETE FROM customers WHERE id = ${id}`;
            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    res.status(405).send('Method Not Allowed');
};
