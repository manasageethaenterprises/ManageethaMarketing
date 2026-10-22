const { Octokit } = require('@octokit/rest');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!token) {
        return res.status(400).json({ error: 'WHATSAPP_ACCESS_TOKEN is not configured.' });
    }

    try {
        // Collect request stream into a buffer (works with bodyParser: false)
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        const action = req.query.action;

        // Action 1: Initialize Meta Resumable Upload Session
        if (action === 'init_session') {
            const rawBody = buffer.toString('utf8');
            let parsed = {};
            try { parsed = JSON.parse(rawBody); } catch (e) {}

            const fileLength = parsed.fileLength || req.query.file_length;
            const mimeType = parsed.mimeType || req.query.mime_type || 'video/mp4';

            if (!fileLength) {
                return res.status(400).json({ error: 'fileLength is required to initialize Meta upload session.' });
            }

            const sessionUrl = `https://graph.facebook.com/v19.0/app/uploads?file_length=${fileLength}&file_type=${encodeURIComponent(mimeType)}&access_token=${token}`;
            const sessionRes = await fetch(sessionUrl, { method: 'POST' });
            const sessionData = await sessionRes.json();

            if (sessionData.error) {
                const errMsg = sessionData.error.error_user_msg || sessionData.error.message || JSON.stringify(sessionData.error);
                return res.status(400).json({ error: errMsg });
            }

            if (!sessionData.id) {
                return res.status(500).json({ error: 'Meta did not return a valid upload session ID.' });
            }

            return res.status(200).json({ success: true, sessionId: sessionData.id });
        }

        // Action 2: Stream chunk directly to Meta Resumable Upload Session
        if (action === 'upload_chunk') {
            const sessionId = req.query.session_id;
            const fileOffset = req.query.file_offset || '0';
            const mimeType = req.query.mime_type || req.headers['content-type'] || 'application/octet-stream';

            if (!sessionId) {
                return res.status(400).json({ error: 'session_id is required for chunk upload.' });
            }

            const uploadUrl = `https://graph.facebook.com/v19.0/${sessionId}`;
            const uploadRes = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `OAuth ${token}`,
                    'file_offset': String(fileOffset),
                    'Content-Type': mimeType
                },
                body: buffer
            });

            const uploadData = await uploadRes.json();

            if (uploadData.error) {
                const errMsg = uploadData.error.error_user_msg || uploadData.error.message || JSON.stringify(uploadData.error);
                return res.status(400).json({ error: errMsg });
            }

            // If this was the last chunk, Meta returns the template sample handle 'h'
            if (uploadData.h) {
                return res.status(200).json({ success: true, handle: uploadData.h, done: true });
            }

            return res.status(200).json({ success: true, done: false, data: uploadData });
        }

        // Legacy Fallback: Single Base64 POST
        let base64Data, fileName, mimeType;
        try {
            const parsed = JSON.parse(buffer.toString('utf8'));
            base64Data = parsed.base64Data;
            fileName = parsed.fileName;
            mimeType = parsed.mimeType;
        } catch (e) {}

        if (!base64Data || !fileName || !mimeType) {
            return res.status(400).json({ error: 'Missing required fields or invalid action.' });
        }

        const cleanBase64 = base64Data.replace(/^data:.*?;base64,/, "");
        const fileBuf = Buffer.from(cleanBase64, 'base64');

        let handle = null;
        try {
            const sessionUrl = `https://graph.facebook.com/v19.0/app/uploads?file_length=${fileBuf.length}&file_type=${encodeURIComponent(mimeType)}&access_token=${token}`;
            const sessionRes = await fetch(sessionUrl, { method: 'POST' });
            const sessionData = await sessionRes.json();

            if (sessionData && sessionData.id) {
                const uploadRes = await fetch(`https://graph.facebook.com/v19.0/${sessionData.id}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `OAuth ${token}`,
                        'file_offset': '0',
                        'Content-Type': mimeType
                    },
                    body: fileBuf
                });
                const uploadData = await uploadRes.json();
                if (uploadData && uploadData.h) {
                    handle = uploadData.h;
                }
            }
        } catch (err) {
            console.error("Server-side Meta Resumable Upload error:", err);
        }

        if (!handle) {
            return res.status(400).json({ error: 'Failed to upload sample media to Meta. Please verify WHATSAPP_ACCESS_TOKEN.' });
        }

        return res.status(200).json({ success: true, handle });

    } catch (error) {
        console.error('Upload media error:', error);
        return res.status(500).json({ error: error.message });
    }
};

module.exports.config = {
    api: {
        bodyParser: false
    }
};
