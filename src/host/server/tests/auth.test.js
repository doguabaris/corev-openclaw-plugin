'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const supertest_1 = __importDefault(require('supertest'));
const mongoose_1 = __importDefault(require('mongoose'));
const mongodb_memory_server_1 = require('mongodb-memory-server');
const app_1 = __importDefault(require('../src/app'));
const user_model_1 = require('../src/models/user.model');
jest.setTimeout(15000);
let mongo;
beforeAll(async () => {
  mongo = await mongodb_memory_server_1.MongoMemoryServer.create();
  const uri = mongo.getUri();
  await mongoose_1.default.connect(uri);
});
afterAll(async () => {
  await mongoose_1.default.disconnect();
  await mongo.stop();
});
afterEach(async () => {
  await user_model_1.User.deleteMany({});
});
describe('Auth API', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'secure123',
  };
  it('should sign up a new user', async () => {
    const res = await (0, supertest_1.default)(app_1.default)
      .post('/api/auth/signup')
      .send(testUser)
      .expect(201);
    expect(res.body.token).toBeDefined();
  });
  it('should not allow duplicate signups', async () => {
    await (0, supertest_1.default)(app_1.default).post('/api/auth/signup').send(testUser);
    const res = await (0, supertest_1.default)(app_1.default)
      .post('/api/auth/signup')
      .send(testUser)
      .expect(409);
    expect(res.body.error).toMatch(/already exists/i);
  });
  it('should login with valid credentials', async () => {
    await (0, supertest_1.default)(app_1.default).post('/api/auth/signup').send(testUser);
    const res = await (0, supertest_1.default)(app_1.default)
      .post('/api/auth/login')
      .send(testUser)
      .expect(200);
    expect(res.body.token).toBeDefined();
  });
  it('should reject login with wrong password', async () => {
    await (0, supertest_1.default)(app_1.default).post('/api/auth/signup').send(testUser);
    const res = await (0, supertest_1.default)(app_1.default)
      .post('/api/auth/login')
      .send({ ...testUser, password: 'wrong' })
      .expect(401);
    expect(res.body.error).toMatch(/invalid/i);
  });
  it('should return user data on /whoami with valid token', async () => {
    const signupRes = await (0, supertest_1.default)(app_1.default)
      .post('/api/auth/signup')
      .send(testUser);
    const token = signupRes.body.token;
    const res = await (0, supertest_1.default)(app_1.default)
      .get('/api/auth/whoami')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toHaveProperty('email', testUser.email);
    expect(res.body).not.toHaveProperty('passwordHash');
  });
  it('should reject /whoami with invalid token', async () => {
    const res = await (0, supertest_1.default)(app_1.default)
      .get('/api/auth/whoami')
      .set('Authorization', 'Bearer invalidtoken')
      .expect(401);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toMatch('Unauthorized');
  });
});
