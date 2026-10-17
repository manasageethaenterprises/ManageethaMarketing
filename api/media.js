const { getDb } = require('../lib/db');

function detectFileTypeFromBuffer(buffer) {
    if (!buffer || buffer.length < 4) return null;
    
    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        return { ext: '.jpg', mime: 'image/jpeg' };
    }
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        return { ext: '.png', mime: 'image/png' };
    }
    // GIF: 47 49 46 38
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
        return { ext: '.gif', mime: 'image/gif' };
    }
    // WebP: RIFF .... WEBP
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x42 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        return { ext: '.webp', mime: 'image/webp' };
    }
    // PDF: %PDF (25 50 44 46)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        return { ext: '.pdf', mime: 'application/pdf' };
    }
    // Ogg audio: OggS (4F 67 67 53)
    if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
        return { ext: '.ogg', mime: 'audio/ogg' };
    }
    // MP4: ....ftyp
    if (buffer.length >= 12 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
        return { ext: '.mp4', mime: 'video/mp4' };
    }
    // MP3: ID3
    if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
        return { ext: '.mp3', mime: 'audio/mpeg' };
    }

    return null;
}

function getExtFromMime(mime) {
    if (!mime) return '.bin';
    const m = mime.toLowerCase();
    if (m.includes('jpeg') || m.includes('jpg')) return '.jpg';
    if (m.includes('png')) return '.png';
    if (m.includes('webp')) return '.webp';
    if (m.includes('gif')) return '.gif';
    if (m.includes('mp4') || m.includes('video/mp4')) return '.mp4';
    if (m.includes('pdf')) return '.pdf';
    return '.bin';
}

async function handleMediaProxy(req, res, { media_id, directUrl, filename, hintMime, download }) {
    try {
        const isMetaCdn = directUrl && (
            directUrl.includes('scontent.whatsapp.net') ||
            directUrl.includes('scontent.') ||
            directUrl.includes('fbcdn.net') ||
            directUrl.includes('fbsbx.com') ||
            directUrl.includes('facebook.com')
        );

        if (directUrl && !isMetaCdn) {
            if (directUrl.startsWith('http://') || directUrl.startsWith('https://')) {
                if (typeof res.redirect === 'function') {
                    return res.redirect(directUrl);
                }
                res.setHeader('Location', directUrl);
                return res.status(302).send('');
            }
        }

        const token = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
        let downloadUrl = directUrl;
        let mimeType = hintMime || 'application/octet-stream';
        const cleanMediaId = media_id ? String(media_id).trim() : null;

        if (cleanMediaId) {
            if (!token) return res.status(401).json({ error: 'WhatsApp Access Token is not configured.' });
            try {
                const metaRes = await fetch(`https://graph.facebook.com/v19.0/${cleanMediaId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const metaData = await metaRes.json();
                if (metaData && metaData.url) {
                    downloadUrl = metaData.url;
                    if (metaData.mime_type) mimeType = metaData.mime_type;
                } else {
                    return res.status(404).json({ error: (metaData && metaData.error && metaData.error.message) || 'Media not found.' });
                }
            } catch (err) {
                return res.status(502).json({ error: 'Failed to contact Meta API: ' + err.message });
            }
        }

        if (!downloadUrl) {
            return res.status(400).json({ error: 'media_id or url parameter is required' });
        }

        const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
        if (token && (downloadUrl.includes('fbsbx.com') || downloadUrl.includes('facebook.com') || downloadUrl.includes('graph.facebook.com'))) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const binaryRes = await fetch(downloadUrl, { headers });
        if (!binaryRes.ok) {
            return res.status(binaryRes.status === 401 || binaryRes.status === 403 ? 401 : 404).json({
                error: `Failed to download media: ${binaryRes.statusText}`
            });
        }

        const arrayBuf = await binaryRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        const detected = detectFileTypeFromBuffer(buffer);
        const cdnContentType = binaryRes.headers.get('content-type');
        const finalContentType = (detected && detected.mime) 
            || (mimeType && mimeType !== 'application/octet-stream' ? mimeType : null) 
            || (cdnContentType && cdnContentType !== 'application/octet-stream' ? cdnContentType : null) 
            || mimeType 
            || 'application/octet-stream';

        const finalExt = (detected && detected.ext) || getExtFromMime(finalContentType);
        let outFilename = filename ? String(filename).trim() : `whatsapp_media_${cleanMediaId || Date.now()}`;
        if (!outFilename.includes('.')) outFilename += finalExt;

        res.setHeader('Content-Type', finalContentType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (download === '1' || download === 'true') {
            res.setHeader('Content-Disposition', `attachment; filename="${outFilename}"`);
        } else {
            res.setHeader('Content-Disposition', `inline; filename="${outFilename}"`);
        }

        return res.status(200).send(buffer);
    } catch (e) {
        console.error("Media proxy error:", e);
        return res.status(500).json({ error: e.message });
    }
}

module.exports = async (req, res) => {
    // 1. GET Requests: Handles both media proxy and library listing
    if (req.method === 'GET') {
        const { media_id, url: directUrl, filename, mime: hintMime, download, action } = req.query || {};

        // If media proxy requested via query parameters
        if (directUrl || media_id || action === 'proxy') {
            return await handleMediaProxy(req, res, { media_id, directUrl, filename, hintMime, download });
        }

        try {
            const sql = getDb();
            try {
                await sql`
                    CREATE TABLE IF NOT EXISTS media_library (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        type VARCHAR(50) DEFAULT 'image',
                        meta_media_id VARCHAR(255),
                        file_url TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `;
            } catch (e) {}

            const dbMedia = await sql`SELECT * FROM media_library ORDER BY created_at DESC`;
            return res.status(200).json(dbMedia);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    // 2. POST Requests: Add item to media library
    if (req.method === 'POST') {
        try {
            const sql = getDb();
            const { name, type, meta_media_id, file_url } = req.body;
            if (!name) return res.status(400).json({ error: 'Media name required' });

            const result = await sql`
                INSERT INTO media_library (name, type, meta_media_id, file_url)
                VALUES (${name}, ${type || 'image'}, ${meta_media_id || null}, ${file_url || null})
                RETURNING *
            `;
            return res.status(200).json({ success: true, media: result[0] });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    // 3. DELETE Requests: Remove item from media library
    if (req.method === 'DELETE') {
        try {
            const sql = getDb();
            const { id } = req.query;
            if (!id) return res.status(400).json({ error: 'Media ID required' });

            await sql`DELETE FROM media_library WHERE id = ${id}`;
            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    res.status(405).send('Method Not Allowed');
};
