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
const config_model_1 = require('../src/models/config.model');
const project_model_1 = require('../src/models/project.model');
const slugify_1 = __importDefault(require('slugify'));
jest.setTimeout(15000);
let mongo;
let token;
let projectId;
beforeAll(async () => {
  mongo = await mongodb_memory_server_1.MongoMemoryServer.create();
  const uri = mongo.getUri();
  await mongoose_1.default.connect(uri);
  const res = await (0, supertest_1.default)(app_1.default).post('/api/auth/signup').send({
    email: 'cliuser@example.com',
    password: 'cli123',
  });
  token = res.body.token;
  const user = await user_model_1.User.findOne({ email: 'cliuser@example.com' });
  const project = await project_model_1.Project.create({
    name: 'atlas',
    slug: (0, slugify_1.default)('atlas', { lower: true, strict: true }),
    owner: user._id,
  });
  projectId = project._id.toString();
});
afterAll(async () => {
  await mongoose_1.default.disconnect();
  await mongo.stop();
});
afterEach(async () => {
  await config_model_1.Config.deleteMany({});
});
describe('Config CLI API', () => {
  const projectSlug = 'atlas';
  it('should upload a new config version', async () => {
    const res = await (0, supertest_1.default)(app_1.default)
      .post(`/api/configs/${projectSlug}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'atlas',
        version: '1.0.0',
        config: { db: 'sqlite' },
      })
      .expect(201);
    expect(res.body).toHaveProperty('_id');
    expect(res.body.version).toBe('1.0.0');
  });
  it('should retrieve the latest config version', async () => {
    await config_model_1.Config.create([
      {
        name: 'atlas',
        version: '1.0.0',
        config: { a: 1 },
        project: projectId,
        createdAt: new Date('2020-01-01'),
      },
      {
        name: 'atlas',
        version: '1.2.0',
        config: { b: 2 },
        project: projectId,
        createdAt: new Date('2024-01-01'),
      },
    ]);
    const res = await (0, supertest_1.default)(app_1.default)
      .get(`/api/configs/${projectSlug}/latest`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.version).toBe('1.2.0');
    expect(res.body.config.b).toBe(2);
  });
  it('should fetch a specific config version', async () => {
    await config_model_1.Config.create({
      name: 'atlas',
      version: '2.0.1',
      config: { x: 'y' },
      project: projectId,
    });
    const res = await (0, supertest_1.default)(app_1.default)
      .get(`/api/configs/${projectSlug}/2.0.1`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.config).toHaveProperty('x', 'y');
  });
  it('should return 404 for missing version', async () => {
    const res = await (0, supertest_1.default)(app_1.default)
      .get(`/api/configs/${projectSlug}/9.9.9`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    expect(res.body.message).toMatch(/not found/i);
  });
  it('should reject invalid payloads on upload', async () => {
    const res = await (0, supertest_1.default)(app_1.default)
      .post(`/api/configs/${projectSlug}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'atlas', config: {} })
      .expect(400);
    expect(res.body.message).toMatch(/version/i);
  });
});
