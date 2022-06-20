const express = require('express');
const app = express();

let bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { request } = require('http');
const { response } = require('express');

// BN과 CA에 접속하기 위한 세팅
const FabricCAServices = require('fabric-ca-client');
const { FileSystemWallet, Gateway, X509WalletMixin } = require('fabric-network')

const ccpPath = path.resolve(__dirname, '..', '..', 'basic-network', 'connection.json');
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);

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

app.get('/transfer', (request, response) => {
  response.sendFile(__dirname + '/views/transfer.html');
})

//REST API 라우팅 (5종)
app.post('/user', async (request, response) => {
  const mode = request.body.mode // body의 name 
  console.log("/user-post- " + mode);

  if (mode === 1) { // 관리자 인증서
    const id = request.body.id;
    const pw = request.body.pw;

    console.log('/user-post- ' + id + "-" + pw)

    try {
      // Create CA
      const caURL = ccp.certificateAuthorities['ca.example.com'].url;
      const ca = new FabricCAServices(caURL);

      const walletPath = path.join(process.cwd(), 'wallet');
      const wallet = new FileSystemWallet(walletPath);
      console.log(`Wallet path: ${walletPath}`)

      const adminExists = await wallet.exists('admin');
      if (adminExists) {
        console.log('An identity for the admin user "admin" already exists in the wallet')
        const obj = JSON.parse('{"ERR_MSG": "An identity for the admin user "admin" already exists in the wallet')
        response.status(400).json(obj) // file 전송 필요 시, json() 대신 send()를 써도 됨.
        return;
      }

      const enrollment = await ca.enroll({ enrollmentID: id, enrollmentSecret: pw });
      const identity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
      wallet.import('admin', identity);
      console.log('Successfully enrolled admin user "admin" and imported it into the wallet');
      const obj = JSON.parse('{"PAYLOAD": "Successfully enrolled admin user and imported it into the wallet"}')
      response.status(200).json(obj);

    } catch (error) {
      console.error(`Fail to enroll admin user "admin" : ${errpr}`)
      // client (web brower) 에게 오류를 전달
      const obj = JSON.parse('{"ERR_MSG": "Fail to enroll admin user admin: ${error}"}')
      response.status(400).json(obj) // file 전송 필요 시, json() 대신 send()를 써도 됨.
    }

  } else if (mode === 2) { // 사용자 인증서
    const id = request.body.id;
    const role = request.body.role;
    console.log('/user-post- ' + id + "-" + role)
    try {
      const walletPath = path.join(process.cwd(), 'wallet');
      const wallet = new FileSystemWallet(walletPath);
      console.log(`Wallet path: ${walletPath}`)

      // Check to see if we've already enrolled the user.
      const userExists = await wallet.exists(id);
      if (userExists) {
        console.log('An identity for the user already exists in the wallet')
        const obj = JSON.parse('{"ERR_MSG": "An identity for the user already exists in the wallet"}');
        response.status(400).json(obj);
        return;
      }

      const adminExists = await wallet.exists('admin');
      if (!adminExists) {
        console.log('An identity for the admin user "admin" already exists in the wallet')
        console.log('Run the enrollAdmin.js application before retrying');
        // client (web brower)에게 오류를 전달
        const obj = JSON.parse('{"ERR_MSG": "An identity for the admin user admin already exists in the wallet"}')
        response.status(400).json(obj) // file 전송 필요 시, json() 대신 send()를 써도 됨.
        return;
      }

      const gateway = new Gateway()
      await gateway.connect(ccp, { wallet, identity: 'admin', discovery: { enabled: false } })

      const ca = gateway.getClient().getCertificateAuthority();
      const adminIdentity = gateway.getCurrentIdentity();

      const secret = await ca.register({ affiliation: 'org1.department1', enrollmentID: id, role: role }, adminIdentity);
      const enrollment = await ca.enroll({ enrollmentID: id, enrollmentSecret: secret });
      const userIdentity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
      wallet.import(id, userIdentity);
      console.log(`Successfully registered and and enrolled admin user "${id}" and imported it into the wallet`)
      const obj = JSON.parse('{"PAYLOAD": "Successfully registered and and enrolled admin user and imported it into the wallet"}')
      response.status(200).json(obj);

    } catch (error) {
      console.error(`Fail to enroll register user : ${errpr}`)
      // client (web brower) 에게 오류를 전달
      const obj = JSON.parse('{"ERR_MSG": "Fail to enroll register user: ${error}"}')
      response.status(400).json(obj) // file 전송 필요 시, json() 대신 send()를 써도 됨.
    }
  }
})

app.post('/asset', async (request, response) => {
  // request에서 인자값(data)를 추출
  const id = request.body.id
  const key = request.body.key
  const value = request.body.value
  console.log('/asset-post-' + id + '-' + key + '-' + value);
  // BN에 접곳갷서 simpleasset 체인코드 중 set 기능을 호출

  // 0. wallet에 있는 사용자 인증서 가져오기
  const walletPath = path.join(process.cwd(), 'wallet');
  const wallet = new FileSystemWallet(walletPath);
  console.log(`Wallet path: ${walletPath}`)

  // Check to see if we've already enrolled the user.
  const userExists = await wallet.exists(id);
  if (userExists) {
    console.log('An identity for the user already exists in the wallet')
    const obj = JSON.parse('{"ERR_MSG": "An identity for the user already exists in the wallet"}');
    response.status(400).json(obj);
    return;
  }
  // 1. 게이트웨이 접속
  const gateway = new Gateway()
  await gateway.connect(ccp, { wallet, identity: id, discovery: { enabled: false } })

  // 2. 채널 (mychannel) 접속
  const network = await gateway.getNetwork('mychannel');

  // 3. 체인코드 가져오기 (simpleasset)
  const contract = network.getContract('simpleasset');

  // 4. 체인코드 호출하기 (set ( key, value ))
  await contract.submitTransaction('set', key, value);
  console.log('Transcation has been submitted');

  // 5. 게이트웨이 연결 해제 
  await gateway.disconnect();


  // 수행 결과물 client(web browser)에게 전달!
  const resultPath = path.join(process.cwd(), '/views/result.html');
  resultHTML = resultPath.replace("<div></div>", "<div><p>Transaction has been submitted</p></div>")
  response.status(200).send(resultHTML);

})

// 서버 시작
app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);

