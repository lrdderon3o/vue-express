var express = require('express');
var path = require('path');
var app = express();
var packageJson = require('../../package.json');

app.set('views', path.join(__dirname, '../views'));

app.get('/', function (req, res) {
  res.render('index.ejs', { title: packageJson.name });
});

module.exports = app;