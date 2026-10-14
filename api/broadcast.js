const { getDb } = require('../lib/db');

// Format media_id into Meta-compatible object: { id: <integer> } or { link: <url> }
function formatMetaMediaObject(media_id, req) {
    if (!media_id) return null;
    const str = String(media_id).trim();
    if (!str) return null;

    // Filter out Meta internal CDN links that cannot be fetched publicly by Meta Cloud API
    if (str.includes('scontent.whatsapp.net') || str.includes('scontent.') || str.includes('fbcdn.net')) {
        return null;
    }

    if (/^\d+$/.test(str)) {
        const num = parseInt(str, 10);
        if (!isNaN(num) && num < Number.MAX_SAFE_INTEGER) {
            return { id: num };
        }
        return { id: str };
    }

    let fullUrl = str;
    if (!str.startsWith('http://') && !str.startsWith('https://')) {
        const host = (req && req.headers && req.headers['host']) || 'marketing.inspenox.in';
        const proto = (req && req.headers && req.headers['x-forwarded-proto']) || 'https';
        const cleanPath = str.startsWith('/') ? str : '/' + str;
        fullUrl = `${proto}://${host}${cleanPath}`;
    }
    return { link: fullUrl };
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { target, type, content, media_id, template_name, template_language } = req.body;

        const sql = getDb();
        let customersToMessage = [];
        
        if (target === 'all') {
            customersToMessage = await sql`SELECT id, name, phone FROM customers`;
        } else if (Array.isArray(target)) {
            customersToMessage = await sql`SELECT id, name, phone FROM customers WHERE id = ANY(${target})`;
        } else {
            return res.status(400).json({ error: 'Invalid target' });
        }

        const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1196613980211733';
        const token = process.env.WHATSAPP_ACCESS_TOKEN;
        const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;

        let sent = 0;
        let failed = 0;
        let errors = [];

        for (const cust of customersToMessage) {
            const cleanPhone = cust.phone ? cust.phone.replace(/[^0-9]/g, '') : '';
            if (!cleanPhone) {
                failed++;
                errors.push(`Invalid phone format for customer ID ${cust.id}`);
                continue;
            }

            let payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: cleanPhone,
                type: type
            };

            if (type === 'text') {
                payload.text = { body: content };
            } else if (type === 'image') {
                const mediaObj = formatMetaMediaObject(media_id, req);
                payload.image = mediaObj ? { ...mediaObj, caption: content } : { caption: content };
            } else if (type === 'video') {
                const mediaObj = formatMetaMediaObject(media_id, req);
                payload.video = mediaObj ? { ...mediaObj, caption: content } : { caption: content };
            }

            let responseData = null;

            if (type === 'template') {
                const custName = (cust.name && cust.name.trim()) ? cust.name.trim() : 'Customer';
                const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
                
                // Fetch template metadata once from Meta WABA API if available
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

                const primaryLang = template_language || (templateMeta ? templateMeta.language : 'en');
                const langCodes = [primaryLang];
                if (primaryLang === 'en') langCodes.push('en_US');
                else if (primaryLang === 'en_US') langCodes.push('en');

                let lastErr = null;
                let missingMediaError = null;

                // Build template payload dynamically based on Meta template definition
                const buildPayloadObj = (langCode) => {
                    const componentsPayload = [];
                    const tmplComponents = templateMeta ? (templateMeta.components || []) : [];

                    // 1. HEADER component (IMAGE, VIDEO, DOCUMENT)
                    const headerComp = tmplComponents.find(c => c.type === 'HEADER');
                    if (headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
                        const format = headerComp.format.toLowerCase();
                        let mediaObj = null;

                        if (media_id) {
                            mediaObj = formatMetaMediaObject(media_id, req);
                        } else if (headerComp.example) {
                            if (headerComp.example.header_handle && headerComp.example.header_handle[0]) {
                                mediaObj = formatMetaMediaObject(headerComp.example.header_handle[0], req);
                            } else if (headerComp.example.header_url && headerComp.example.header_url[0]) {
                                mediaObj = formatMetaMediaObject(headerComp.example.header_url[0], req);
                            }
                        }

                        if (mediaObj) {
                            componentsPayload.push({
                                type: "header",
                                parameters: [{
                                    type: format,
                                    [format]: mediaObj
                                }]
                            });
                        } else {
                            missingMediaError = `Template '${template_name}' requires a header ${format} file. Please select or upload a media file.`;
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
                    if (media_id) {
                        const mType = (req.body.media_type || 'image').toLowerCase();
                        const isVid = (mType === 'video');
                        const isDoc = (mType === 'document');
                        const mediaFormat = isVid ? 'video' : (isDoc ? 'document' : 'image');
                        const mediaObj = formatMetaMediaObject(media_id, req);
                        if (mediaObj) {
                            baseHeaderComp.push({
                                type: "header",
                                parameters: [{
                                    type: mediaFormat,
                                    [mediaFormat]: mediaObj
                                }]
                            });
                        }
                    }

                    for (const langCode of langCodes) {
                        const variations = [
                            // Variation 1: Clean static template (e.g. hello_world or no-var templates)
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
            }

            const data = responseData;

            if (data.error) {
                failed++;
                let errMsg = data.error.message || `Meta API Error (${data.error.code})`;
                if (data.error.code === 100 && (cleanPhone === '917981656294' || cleanPhone === '7981656294')) {
                    errMsg = `Cannot send to WhatsApp Business account's own registered number (${cleanPhone})`;
                }
                errors.push(errMsg);
            } else {
                sent++;
                const wa_message_id = (data.messages && data.messages[0]) ? data.messages[0].id : 'sent_' + Date.now();
                const saveContent = type === 'template' ? `[Template] ${template_name}` : content;
                await sql`
                    INSERT INTO messages (customer_id, direction, type, content, wa_message_id, status) 
                    VALUES (${cust.id}, 'outbound', ${type}, ${saveContent}, ${wa_message_id}, 'sent')
                `;
            }

            // Small delay to prevent rate limits
            await new Promise(r => setTimeout(r, 100));
        }

        // Log campaign
        const campaignContent = type === 'template' ? `Template: ${template_name}` : content;
        await sql`
            INSERT INTO campaigns (name, message_type, content, sent_count, failed_count) 
            VALUES (${'Broadcast ' + new Date().toISOString()}, ${type}, ${campaignContent}, ${sent}, ${failed})
        `;

        return res.status(200).json({ success: true, sent, failed, errors });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
