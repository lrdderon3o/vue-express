const express = require('express');
const app = express();
const Parser = require('../services/parser');

const longPoolRequests = {};
const setLongPoolRequest = (key, value) => {
    longPoolRequests[key] = value;
};
const getLongPoolRequest = (key) => {
    return longPoolRequests[key];
};
const removeLongPoolRequest = (key) => {
    delete longPoolRequests[key];
};

app.get('/page-info', (req, res) => {
    const {page, auth} = req.query || {};
    if (page && auth) {
        const splitter = '/backend';
        const [domain, pageUrl] = page.split(splitter);
        const parser = new Parser(domain, auth);
        parser.getPage(splitter + pageUrl).then((data) => {
            res.json(parser.getPreparedPageEditJSON(data));
        }).catch(() => {
            res.status(500).send('Get page error');
        })
    } else {
        res.status(500).send('Auth error')
    }
});

app.post('/update-page', (req, res) =>  {
    const {page, auth} = req.query || {};
    if (page && auth) {
        const splitter = '/backend';
        const [domain, pageUrl] = page.split(splitter);
        const parser = new Parser(domain, auth);
        parser.getPage(splitter + pageUrl).then((data) => {
            const {locales, newValues} = req.body;
            const longPoolRequest = parser.getLongPoolRequest(newValues, locales, data);
            setLongPoolRequest(page, longPoolRequest);
            res.json({requestId: page});
        }).catch(() => {
            res.status(500).send('Get page error');
        })
    } else {
        res.status(500).send('Auth error')
    }
});

app.get('/apply-request',  async (req, res) => {
    const {requestId} = req.query || {};
    const requestData = getLongPoolRequest(requestId);

    if (requestData) {
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.flushHeaders(); // flush the headers to establish SSE with client

        const parser = new Parser(requestData.domain, requestData.cookie);

        parser.applyRequest(requestData, res, () => {
            removeLongPoolRequest(requestId);
        });

    } else {
        res.status(500).send('Request not found');
    }

});

module.exports = app;