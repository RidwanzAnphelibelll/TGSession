#!/usr/bin/env node

const express = require('express');
const { Api } = require('telegram/tl');
const { TelegramClient } = require('telegram');
const { StringSession }  = require('telegram/sessions');

const router   = express.Router();
const sessions = new Map();

function makeId() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function safeDisconnect(client) {
    try { client._destroyed = true; } catch (_) {}
    try { client.disconnect(); } catch (_) {}
}

router.post('/start', async (req, res) => {
    const { apiId, apiHash, phone } = req.body;

    if (!apiId || !apiHash || !phone) {
        return res.json({ success: false, message: 'apiId, apiHash, dan phone wajib diisi.' });
    }

    try {
        const client = new TelegramClient(new StringSession(''), parseInt(apiId), apiHash, {
            connectionRetries: 3,
            retryDelay:        1000,
            autoReconnect:     false,
            receiveUpdates:    false,
        });

        await client.connect();

        const result = await client.sendCode({ apiId: parseInt(apiId), apiHash }, phone);

        const id = makeId();

        sessions.set(id, {
            client,
            phoneCodeHash: result.phoneCodeHash,
            phone,
            apiId:  parseInt(apiId),
            apiHash,
        });

        setTimeout(() => {
            const s = sessions.get(id);
            if (s) {
                safeDisconnect(s.client);
                sessions.delete(id);
            }
        }, 5 * 60 * 1000);

        res.json({ success: true, sessionId: id });

    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

router.post('/verify', async (req, res) => {
    const { sessionId, code } = req.body;

    if (!sessionId || !code) {
        return res.json({ success: false, message: 'sessionId dan code wajib diisi.' });
    }

    const s = sessions.get(sessionId);
    if (!s) {
        return res.json({ success: false, message: 'Sesi tidak ditemukan atau sudah kedaluwarsa.' });
    }

    try {
        await s.client.invoke(new Api.auth.SignIn({
            phoneNumber:   s.phone,
            phoneCodeHash: s.phoneCodeHash,
            phoneCode:     code.replace(/\s+/g, '').trim(),
        }));
    } catch (e) {
        sessions.delete(sessionId);
        safeDisconnect(s.client);
        return res.json({ success: false, message: e.message });
    }

    const stringSession = s.client.session.save();
    sessions.delete(sessionId);
    safeDisconnect(s.client);

    res.json({ success: true, session: stringSession });
});

process.on('uncaughtException', (err) => {
    if (err && err.message === 'TIMEOUT') return;
    console.error(err);
});

process.on('unhandledRejection', (err) => {
    if (err && err.message === 'TIMEOUT') return;
    console.error(err);
});

module.exports = { router };
