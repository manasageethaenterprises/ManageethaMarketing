// Format media_id into Meta-compatible object: { id: <integer> } or { link: <url> }
function formatMetaMediaObject(media_id, req) {
    if (!media_id) return null;
    const str = String(media_id).trim();
    if (!str) return null;

    // Filter out Meta internal CDN links that cannot be fetched publicly by Meta Cloud API
    if (str.includes('scontent.whatsapp.net') || str.includes('scontent.') || str.includes('fbcdn.net')) {
        return null;
    }

    // Numeric IDs: Meta requires integer type for image.id / video.id
    if (/^\d+$/.test(str)) {
        const num = parseInt(str, 10);
        if (!isNaN(num) && num < Number.MAX_SAFE_INTEGER) {
            return { id: num };
        }
        return { id: str };
    }

    // URLs: pass as link
    let fullUrl = str;
    if (!str.startsWith('http://') && !str.startsWith('https://')) {
        const host = (req && req.headers && req.headers['host']) || 'marketing.inspenox.in';
        const proto = (req && req.headers && req.headers['x-forwarded-proto']) || 'https';
        const cleanPath = str.startsWith('/') ? str : '/' + str;
        fullUrl = `${proto}://${host}${cleanPath}`;
    }
    return { link: fullUrl };
}

// In-memory cache for resolved Meta template header media IDs
// Key: `${template_name}_${language}_${format}` -> { mediaId, mediaUrl, timestamp }
const templateHeaderMediaCache = new Map();

/**
 * Resolves header media for a Meta template:
 * - If a custom valid media is provided, uses that.
 * - Otherwise, automatically fetches the approved template header media from Meta CDN (scontent.whatsapp.net),
 *   uploads it to Meta WhatsApp Cloud API (/{phoneId}/media) to get an official Meta Media ID,
 *   and caches it for instant reuse.
 */
async function resolveTemplateHeaderMedia(templateMeta, providedMediaId, req, phoneId, token) {
    if (!templateMeta) return null;
    const tmplComponents = templateMeta.components || [];
    const headerComp = tmplComponents.find(c => c.type === 'HEADER');
    if (!headerComp || !['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
        return null; // Template does not require a media header
    }

    const format = headerComp.format.toLowerCase();

    // 1. If user provided a custom media_id (and it's not the default scontent URL)
    if (providedMediaId && !String(providedMediaId).includes('scontent.whatsapp.net') && !String(providedMediaId).includes('scontent.')) {
        const customObj = formatMetaMediaObject(providedMediaId, req);
        if (customObj) {
            return {
                format,
                mediaObj: customObj,
                mediaUrl: (typeof providedMediaId === 'string' && (providedMediaId.startsWith('http') || providedMediaId.startsWith('/'))) ? providedMediaId : null
            };
        }
    }

    // 2. Automatically resolve from Meta template example content
    let exampleUrl = null;
    if (headerComp.example) {
        if (headerComp.example.header_handle && headerComp.example.header_handle[0]) {
            exampleUrl = headerComp.example.header_handle[0];
        } else if (headerComp.example.header_url && headerComp.example.header_url[0]) {
            exampleUrl = headerComp.example.header_url[0];
        }
    }

    const targetUrl = exampleUrl || (providedMediaId && String(providedMediaId).startsWith('http') ? providedMediaId : null);
    if (!targetUrl) return null;

    // Check cache (valid for 25 days)
    const cacheKey = `${templateMeta.name}_${templateMeta.language || 'default'}_${format}`;
    const cached = templateHeaderMediaCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 25 * 24 * 60 * 60 * 1000)) {
        return {
            format,
            mediaObj: { id: cached.mediaId },
            mediaUrl: cached.mediaUrl || targetUrl
        };
    }

    // If targetUrl is already a numeric ID
    if (/^\d+$/.test(String(targetUrl).trim())) {
        const num = parseInt(targetUrl, 10);
        return {
            format,
            mediaObj: { id: num },
            mediaUrl: null
        };
    }

    // Download from Meta CDN / URL and upload to Meta's /{phoneId}/media endpoint
    if (phoneId && token) {
        try {
            console.log(`Auto-uploading Meta template header media for ${templateMeta.name} (${format})...`);
            const fetchRes = await fetch(targetUrl);
            if (fetchRes.ok) {
                const arrayBuffer = await fetchRes.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const contentType = fetchRes.headers.get('content-type') || (format === 'video' ? 'video/mp4' : 'image/jpeg');
                const ext = contentType.includes('png') ? 'png' : (contentType.includes('mp4') ? 'mp4' : 'jpg');
                const fileName = `template_${templateMeta.name}_header.${ext}`;

                const formData = new FormData();
                formData.append('messaging_product', 'whatsapp');
                formData.append('file', new Blob([buffer], { type: contentType }), fileName);
                formData.append('type', contentType);

                const uploadRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/media`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                const uploadData = await uploadRes.json();
                if (uploadData && uploadData.id) {
                    const numericId = parseInt(uploadData.id, 10) || uploadData.id;
                    templateHeaderMediaCache.set(cacheKey, {
                        mediaId: numericId,
                        mediaUrl: targetUrl,
                        timestamp: Date.now()
                    });
                    console.log(`Successfully auto-attached Meta header media for ${templateMeta.name} -> ID: ${numericId}`);
                    return {
                        format,
                        mediaObj: { id: numericId },
                        mediaUrl: targetUrl
                    };
                } else {
                    console.error("Meta media upload failed for template header:", uploadData);
                }
            }
        } catch (err) {
            console.error("Failed to auto-upload template header media:", err);
        }
    }

    return null;
}

module.exports = {
    formatMetaMediaObject,
    resolveTemplateHeaderMedia,
    templateHeaderMediaCache
};
