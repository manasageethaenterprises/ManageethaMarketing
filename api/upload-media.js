const { Octokit } = require('@octokit/rest');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { base64Data, fileName, mimeType } = req.body;
        if (!base64Data || !fileName || !mimeType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const cleanBase64 = base64Data.replace(/^data:.*?;base64,/, "");
        const buffer = Buffer.from(cleanBase64, 'base64');

        // 1. Upload to Meta API (Resumable Upload Session for template handle 'h' + standard Media ID)
        const token = process.env.WHATSAPP_ACCESS_TOKEN;
        const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        let handle = null;
        let mediaId = null;

        if (token) {
            // Step A: Attempt Resumable Upload Session API to get handle 'h'
            try {
                const sessionUrl = `https://graph.facebook.com/v19.0/app/uploads?file_length=${buffer.length}&file_type=${encodeURIComponent(mimeType)}&access_token=${token}`;
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
                        body: buffer
                    });
                    const uploadData = await uploadRes.json();
                    if (uploadData && uploadData.h) {
                        handle = uploadData.h;
                    }
                }
            } catch (err) {
                console.error("Server-side Meta Resumable Upload Session error:", err);
            }

            // Step B: Standard WhatsApp Media API upload (/{phone_id}/media)
            if (phoneId) {
                try {
                    const formData = new FormData();
                    formData.append('messaging_product', 'whatsapp');
                    formData.append('file', new Blob([buffer], { type: mimeType }), fileName);

                    const metaRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/media`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        },
                        body: formData
                    });
                    const metaData = await metaRes.json();
                    if (metaData && metaData.id) {
                        mediaId = metaData.id;
                        if (!handle) handle = metaData.id;
                    }
                } catch (err) {
                    console.error("Meta media upload error:", err);
                }
            }
        }

        // 2. Upload to GitHub for self-hosted copy (Non-fatal background backup)
        let githubUrl = null;
        if (process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO) {
            try {
                const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
                const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
                const uploadPath = `uploads/${Date.now()}_${cleanFileName}`;

                let fileSha = undefined;
                try {
                    const existingFile = await octokit.repos.getContent({
                        owner: process.env.GITHUB_OWNER,
                        repo: process.env.GITHUB_REPO,
                        path: uploadPath,
                        branch: "main"
                    });
                    if (existingFile.data && existingFile.data.sha) {
                        fileSha = existingFile.data.sha;
                    }
                } catch (getErr) {
                    // File doesn't exist yet, expected for new uploads
                }

                await octokit.repos.createOrUpdateFileContents({
                    owner: process.env.GITHUB_OWNER,
                    repo: process.env.GITHUB_REPO,
                    path: uploadPath,
                    message: `Upload media ${fileName}`,
                    content: cleanBase64,
                    branch: "main",
                    ...(fileSha ? { sha: fileSha } : {})
                });

                githubUrl = `https://raw.githubusercontent.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/main/${uploadPath}`;
            } catch (ghErr) {
                console.warn("GitHub media sync warning (non-fatal):", ghErr.message);
            }
        }

        if (!handle && !mediaId) {
            return res.status(400).json({ error: 'Failed to upload sample media to Meta. Please verify WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.' });
        }

        return res.status(200).json({
            success: true,
            handle: handle,
            media_id: mediaId,
            github_url: githubUrl
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
};
