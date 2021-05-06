const express = require('express');
const app = express();
const moment = require('moment');
const Parser = require('../services/parser');

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

app.get('/digits',  async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders(); // flush the headers to establish SSE with client

    let count = 0;

    while (count < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('Emit', ++count);
        // Emit an SSE that contains the current 'count' as a string
        res.write(`data: ${count}\n\n`);
        if (count === 3) {
            res.end('data: close\n\n');
        }
    }

});
//
// app.post('/posts', function (req, res) {
//   var newPost = {
//     text: req.body.text,
//     id: new Date().getTime(),
//     date: moment().format('MMM Do, HH:mm')
//   };
//
//   if (req.body.text) {
//     db.get('posts').push(newPost).write();
//     res.send(newPost);
//   } else {
//     res.status(400).send(newPost);
//   }
// });
//
// app.delete('/posts/:id', function (req, res) {
//   var deleteResult = db.get('posts').remove({ id: parseInt(req.params.id, 10) }).write();
//
//   if (deleteResult.length) {
//     res.status(200).send(deleteResult);
//   } else {
//     res.status(400).send(deleteResult);
//   }
// });

module.exports = app;