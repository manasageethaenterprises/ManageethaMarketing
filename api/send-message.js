const { getDb } = require('../lib/db');

// Format media_id into Meta-compatible object: { id: <integer|string> } or { link: <url> }
function formatMetaMediaObject(media_id, req) {
    if (!media_id) return null;
    const str = String(media_id).trim();
    if (!str) return null;

    // 1. Numeric Meta Media ID
    if (/^\d+$/.test(str)) {
        const num = parseInt(str, 10);
        if (!isNaN(num) && num < Number.MAX_SAFE_INTEGER) {
            return { id: num };
        }
        return { id: str };
    }

    // 2. Meta Resumable Upload handle (e.g. "4::aW1hZ2UvanBlZw==...") or internal Meta handle
    if (str.startsWith('4::') || str.includes('::') || (!str.includes('/') && !str.includes('.'))) {
        return { id: str };
    }

    // 3. Route Meta internal CDN URLs (scontent/fbcdn) through our media-proxy so Meta Cloud API downloads without 403 Forbidden
    if (str.includes('scontent.whatsapp.net') || str.includes('fbcdn.net') || str.includes('scontent.') || str.includes('lookaside.fbsbx.com')) {
        const host = (req && req.headers && req.headers['host']) || 'marketing.manageetha.in';
        const proto = (req && req.headers && req.headers['x-forwarded-proto']) || 'https';
        return { link: `${proto}://${host}/api/media-proxy?url=${encodeURIComponent(str)}` };
    }

    // 4. Other absolute public URLs
    if (str.startsWith('http://') || str.startsWith('https://')) {
        return { link: str };
    }

    // 5. Local relative media path hosted on the platform
    const host = (req && req.headers && req.headers['host']) || 'marketing.manageetha.in';
    const proto = (req && req.headers && req.headers['x-forwarded-proto']) || 'https';
    const cleanPath = str.startsWith('/') ? str : '/' + str;
    return { link: `${proto}://${host}${cleanPath}` };
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { customer_id, type, content, media_id, template_name, template_language } = req.body;
        if (!customer_id || !type) return res.status(400).json({ error: 'customer_id and type are required' });

        const sql = getDb();
        const customers = await sql`SELECT * FROM customers WHERE id = ${customer_id}`;
        if (customers.length === 0) return res.status(404).json({ error: 'Customer not found' });
        
        const customer = customers[0];
        const phone = customer.phone ? customer.phone.replace(/[^0-9]/g, '') : '';
        if (!phone) return res.status(400).json({ error: 'Customer has an invalid phone number' });

        const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1196613980211733';
        const token = process.env.WHATSAPP_ACCESS_TOKEN;
        const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;

        let payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: phone,
            type: type
        };

        const mediaObjFormatted = formatMetaMediaObject(media_id, req);

        if (type === 'text') {
            payload.text = { preview_url: false, body: content };
        } else if (type === 'image') {
            payload.image = mediaObjFormatted ? { ...mediaObjFormatted, caption: content } : { caption: content };
        } else if (type === 'video') {
            payload.video = mediaObjFormatted ? { ...mediaObjFormatted, caption: content } : { caption: content };
        } else if (type === 'document') {
            payload.document = mediaObjFormatted ? { ...mediaObjFormatted, caption: content, filename: req.body.filename || 'Document' } : { caption: content };
        }

        let responseData = null;
        let outMediaUrl = null;

        if (type === 'template') {
            const custName = (customer.name && customer.name.trim()) ? customer.name.trim() : 'Customer';
            const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
            
            // Fetch template metadata from Meta WABA API
            let templateMeta = null;
            if (wabaId && token && template_name) {
                try {
                    const metaRes = await fetch(`https://graph.facebook.com/v19.0/${wabaId}/message_templates?name=${encodeURIComponent(template_name)}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const metaData = await metaRes.json();
                    if (metaData.data && metaData.data.length > 0) {
                        templateMeta = metaData.data[0];
                    }
                } catch (e) {
                    console.error('Failed to fetch template metadata:', e);
                }
            }

            // Pre-resolve default media for templates if header requires media and media_id not explicitly given
            let templateDefaultMediaObj = null;
            let defaultMediaUrl = null;
            if (templateMeta) {
                const headerComp = (templateMeta.components || []).find(c => c.type === 'HEADER');
                if (headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
                    let defaultSource = media_id;
                    if (!defaultSource && headerComp.example) {
                        const handle = Array.isArray(headerComp.example.header_handle) ? headerComp.example.header_handle[0] : headerComp.example.header_handle;
                        const u = Array.isArray(headerComp.example.header_url) ? headerComp.example.header_url[0] : headerComp.example.header_url;
                        defaultSource = handle || u;
                    }
                    if (defaultSource) {
                        templateDefaultMediaObj = formatMetaMediaObject(defaultSource, req);
                        defaultMediaUrl = (typeof defaultSource === 'string' && defaultSource.startsWith('http')) ? defaultSource : null;
                    }
                }
            }

            const primaryLang = template_language || (templateMeta ? templateMeta.language : 'en');
            const langCodes = [primaryLang];
            if (primaryLang === 'en') langCodes.push('en_US');
            else if (primaryLang === 'en_US') langCodes.push('en');

            let lastErr = null;

            // Build template payload dynamically based on Meta template definition
            const buildPayloadObj = (langCode) => {
                const componentsPayload = [];
                const tmplComponents = templateMeta ? (templateMeta.components || []) : [];

                // 1. HEADER component (IMAGE, VIDEO, DOCUMENT)
                const headerComp = tmplComponents.find(c => c.type === 'HEADER');
                if (headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
                    const format = headerComp.format.toLowerCase();
                    let mediaObj = media_id ? formatMetaMediaObject(media_id, req) : templateDefaultMediaObj;
                    if (!mediaObj && headerComp.example) {
                        const handle = Array.isArray(headerComp.example.header_handle) ? headerComp.example.header_handle[0] : headerComp.example.header_handle;
                        const u = Array.isArray(headerComp.example.header_url) ? headerComp.example.header_url[0] : headerComp.example.header_url;
                        if (handle) mediaObj = formatMetaMediaObject(handle, req);
                        else if (u) mediaObj = formatMetaMediaObject(u, req);
                    }

                    if (mediaObj) {
                        componentsPayload.push({
                            type: "header",
                            parameters: [{
                                type: format,
                                [format]: mediaObj
                            }]
                        });
                    }
                }

                // 2. BODY component (NAMED vs POSITIONAL)
                const bodyComp = tmplComponents.find(c => c.type === 'BODY');
                if (bodyComp) {
                    const bodyParams = [];
                    const isNamed = (templateMeta && templateMeta.parameter_format === 'NAMED') ||
                                    (bodyComp.example && bodyComp.example.body_text_named_params);

                    if (isNamed) {
                        const namedParams = (bodyComp.example && bodyComp.example.body_text_named_params) || [];
                        if (namedParams.length > 0) {
                            namedParams.forEach(p => {
                                bodyParams.push({
                                    type: "text",
                                    parameter_name: p.param_name || "customer_name",
                                    text: custName
                                });
                            });
                        } else if (bodyComp.text) {
                            const matches = bodyComp.text.match(/\{\{([^}]+)\}\}/g);
                            if (matches) {
                                matches.forEach(m => {
                                    const pName = m.replace(/[\{\}]/g, '').trim();
                                    bodyParams.push({
                                        type: "text",
                                        parameter_name: pName,
                                        text: custName
                                    });
                                });
                            }
                        }
                    } else if (bodyComp.text) {
                        const matches = bodyComp.text.match(/\{\{\d+\}\}/g);
                        if (matches) {
                            matches.forEach(() => {
                                bodyParams.push({ type: "text", text: custName });
                            });
                        }
                    }

                    if (bodyParams.length > 0) {
                        componentsPayload.push({
                            type: "body",
                            parameters: bodyParams
                        });
                    }
                }

                return {
                    name: template_name,
                    language: { code: langCode },
                    ...(componentsPayload.length > 0 ? { components: componentsPayload } : {})
                };
            };

            // Strategy 1: Attempt payload constructed directly from Meta metadata
            if (templateMeta) {
                for (const langCode of langCodes) {
                    payload.template = buildPayloadObj(langCode);
                    try {
                        const r = await fetch(url, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        const d = await r.json();
                        if (!d.error) {
                            responseData = d;
                            break;
                        } else {
                            lastErr = d.error;
                        }
                    } catch (e) {
                        lastErr = { message: e.message };
                    }
                }
            }

            // Strategy 2: Fallback variation trials if template metadata was unavailable or failed
            if (!responseData) {
                const baseHeaderComp = [];
                let mediaObj = media_id ? formatMetaMediaObject(media_id, req) : templateDefaultMediaObj;
                if (mediaObj) {
                    const mType = (req.body.media_type || 'image').toLowerCase();
                    const isVid = (mType === 'video');
                    const isDoc = (mType === 'document');
                    const mediaFormat = isVid ? 'video' : (isDoc ? 'document' : 'image');
                    baseHeaderComp.push({
                        type: "header",
                        parameters: [{
                            type: mediaFormat,
                            [mediaFormat]: mediaObj
                        }]
                    });
                }

                for (const langCode of langCodes) {
                    const variations = [
                        // Variation 1: Clean static template
                        {
                            name: template_name,
                            language: { code: langCode },
                            ...(baseHeaderComp.length > 0 ? { components: baseHeaderComp } : {})
                        },
                        // Variation 2: Named Body parameter (Meta NAMED parameter_format)
                        {
                            name: template_name,
                            language: { code: langCode },
                            components: [
                                ...baseHeaderComp,
                                { type: "body", parameters: [{ type: "text", parameter_name: "customer_name", text: custName }] }
                            ]
                        },
                        // Variation 3: Positional Body parameter (Meta POSITIONAL parameter_format)
                        {
                            name: template_name,
                            language: { code: langCode },
                            components: [
                                ...baseHeaderComp,
                                { type: "body", parameters: [{ type: "text", text: custName }] }
                            ]
                        }
                    ];

                    for (const v of variations) {
                        payload.template = v;
                        try {
                            const r = await fetch(url, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                            });
                            const d = await r.json();
                            if (!d.error) {
                                responseData = d;
                                break;
                            } else {
                                lastErr = d.error;
                            }
                        } catch (e) {
                            lastErr = { message: e.message };
                        }
                    }
                    if (responseData) break;
                }
            }

            if (!responseData) {
                responseData = { error: lastErr };
            }

            outMediaUrl = (mediaObjFormatted && mediaObjFormatted.link) ? mediaObjFormatted.link : defaultMediaUrl;
        } else {
            try {
                const r = await fetch(url, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                responseData = await r.json();
            } catch (e) {
                responseData = { error: { message: e.message } };
            }
            outMediaUrl = (mediaObjFormatted && mediaObjFormatted.link) ? mediaObjFormatted.link : (media_id || null);
        }

        const data = responseData;

        if (data.error) {
            let errMsg = data.error.message || `Meta API Error (${data.error.code})`;
            if (data.error.code === 100 && (phone === '917981656294' || phone === '7981656294')) {
                errMsg = "Meta API Error: Cannot send WhatsApp messages to the business's own registered phone number (+91 79816 56294). Please send to a different customer phone number.";
            }
            return res.status(500).json({ error: errMsg });
        }

        const wa_message_id = (data.messages && data.messages[0]) ? data.messages[0].id : 'sent_' + Date.now();

        // Insert into messages table
        const saveContent = type === 'template' ? `[Template] ${template_name}` : content;
        await sql`
            INSERT INTO messages (customer_id, direction, type, content, media_url, wa_message_id, status) 
            VALUES (${customer_id}, 'outbound', ${type}, ${saveContent}, ${outMediaUrl}, ${wa_message_id}, 'sent')
        `;

        return res.status(200).json({ success: true, message_id: wa_message_id });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
