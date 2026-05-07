const crypto = require('crypto');

// Função auxiliar para codificar em Base64URL
function base64url(source) {
  let encodedSource = typeof source === 'string' ? Buffer.from(source) : source;
  encodedSource = encodedSource.toString('base64');
  encodedSource = encodedSource.replace(/=+$/, '');
  encodedSource = encodedSource.replace(/\+/g, '-');
  encodedSource = encodedSource.replace(/\//g, '_');
  return encodedSource;
}

// Função para criar o JWT
function createJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  
  const signature = crypto.createHmac('sha256', secret)
    .update(encodedHeader + '.' + encodedPayload)
    .digest();
    
  const encodedSignature = base64url(signature);
  
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

// 1. Gerar o JWT_SECRET (Uma string forte e aleatória)
const jwtSecret = crypto.randomBytes(32).toString('hex');

// 2. Criar os payloads para as chaves ANON e SERVICE_ROLE
// Definindo expiração para aproximadamente 10 anos
const expDate = Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60);

const anonPayload = {
  role: 'anon',
  iss: 'supabase',
  iat: Math.floor(Date.now() / 1000),
  exp: expDate
};

const serviceRolePayload = {
  role: 'service_role',
  iss: 'supabase',
  iat: Math.floor(Date.now() / 1000),
  exp: expDate
};

// 3. Gerar os JWTs assinados com o JWT_SECRET
const anonKey = createJWT(anonPayload, jwtSecret);
const serviceRoleKey = createJWT(serviceRolePayload, jwtSecret);

// 4. Gerar uma senha forte para o PostgreSQL
const postgresPassword = crypto.randomBytes(24).toString('base64').replace(/[^a-zA-Z0-9]/g, '');

console.log('\n=== CHAVES GERADAS COM SUCESSO ===\n');
console.log('Copie e cole as variáveis abaixo no seu arquivo .env na VPS:\n');
console.log(`POSTGRES_PASSWORD=${postgresPassword}`);
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`ANON_KEY=${anonKey}`);
console.log(`SERVICE_ROLE_KEY=${serviceRoleKey}`);
console.log('\n===================================\n');
