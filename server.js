const express = require('express');
const app = express();

let bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { request } = require('http');
const { response } = require('express');

// 서버 속성
const PORT = 3000;
const HOST = '0.0.0.0'; // 모든 IP를 다 받는 것

// 서버 세팅
app.use(express.static(path.join(__dirname, 'views')))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }));

// 페이지 라우팅
app.get('/', (request, response) => {
  response.sendFile(__dirname + '/views/index.html');
})

// 서버 시작
app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);