// Synthetic identities only. Failure codes are test fixtures, not a vendor contract.
const http = require('node:http');
http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
  if (req.url !== '/api/Kyc/FetchLogin' || req.method !== 'POST') return send(501, { error: 'Not modeled' });
  let body = req.body;
  if (!body) { let raw = ''; for await (const chunk of req) raw += chunk; body = JSON.parse(raw); }
  if (typeof body === 'string') body = JSON.parse(body);
  if (req.headers['x-api-key'] !== 'test-only' || body.fetchCode !== 'TEST' || 'password' in body) return send(401, { success: false });
  if (body.pan === 'ERROR0000A') return send(503, { success: false, code: 'UPSTREAM_ERROR' });
  if (body.pan === 'EMPTY0000A') return send(200, { success: false, code: 'TEST_KYC_NOT_FOUND' });
  if (body.pan === 'WRONG0000A') return send(200, { success: false, message: 'Invalid credentials' });
  if (body.pan === 'BADJS0000A') { res.end('invalid-json'); return; }
  return send(200, { success: true, message: 'KYC details fetched successfully.', data: {
    loginId: 'synthetic-1', pan: body.pan, name: 'Test Customer',
    kycStatus: body.pan === 'WAITI0000A' ? 'PENDING' : 'ACTIVE',
    mobile: body.pan === 'OTHER0000A' ? '9999999999' : '9000000001',
    email: body.pan === 'OTHER0000A' ? 'other@example.test' : 'customer@example.test',
    bankAccountNo: '000000000001', bankName: 'Test Bank', bankIfsc: 'TEST0000001',
    dpAccountNoCDSL: '0000000000000001', bankVerification: 'Verified', dematVerification: 'Verified',
    kycVerifiedDate: '01-Jan-0001',
  } });
}).listen(process.env.PORT || 4510);
