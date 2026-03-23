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
const project_model_1 = require('../src/models/project.model');
jest.setTimeout(15000);
let mongo;
let token;
beforeAll(async () => {
  mongo = await mongodb_memory_server_1.MongoMemoryServer.create();
  const uri = mongo.getUri();
  await mongoose_1.default.connect(uri);
  const res = await (0, supertest_1.default)(app_1.default).post('/api/auth/signup').send({
    email: 'test@example.com',
    password: 'secure123',
  });
  token = res.body.token;
});
afterAll(async () => {
  await mongoose_1.default.disconnect();
  await mongo.stop();
});
afterEach(async () => {
  await project_model_1.Project.deleteMany({});
});
describe('Project API', () => {
  it('should reject unauthenticated project creation', async () => {
    await (0, supertest_1.default)(app_1.default)
      .post('/api/projects')
      .send({ name: 'Unauth Project' })
      .expect(401);
  });
  it('should create a new project', async () => {
    const res = await (0, supertest_1.default)(app_1.default)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Project', description: 'A test project' })
      .expect(201);
    expect(res.body.project).toHaveProperty('slug', 'my-project');
    expect(res.body.project.name).toBe('My Project');
  });
  it('should not allow duplicate project names per user', async () => {
    await (0, supertest_1.default)(app_1.default)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Same Name' });
    await (0, supertest_1.default)(app_1.default)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Same Name' })
      .expect(409);
  });
  it('should list user projects', async () => {
    await (0, supertest_1.default)(app_1.default)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Project One' });
    await (0, supertest_1.default)(app_1.default)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Project Two' });
    const res = await (0, supertest_1.default)(app_1.default)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toHaveLength(2);
  });
  it('should update a project', async () => {
    const createRes = await (0, supertest_1.default)(app_1.default)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Old Name' });
    const projectId = createRes.body.project._id;
    const updateRes = await (0, supertest_1.default)(app_1.default)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' })
      .expect(200);
    expect(updateRes.body.project.name).toBe('New Name');
    expect(updateRes.body.project.slug).toBe('new-name');
  });
  it('should delete a project', async () => {
    const createRes = await (0, supertest_1.default)(app_1.default)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'To Delete' });
    const projectId = createRes.body.project._id;
    await (0, supertest_1.default)(app_1.default)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const listRes = await (0, supertest_1.default)(app_1.default)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listRes.body).toHaveLength(0);
  });
});
