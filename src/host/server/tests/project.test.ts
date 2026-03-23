import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import { Project } from '../src/models/project.model';

jest.setTimeout(15000);

let mongo: MongoMemoryServer;
let token: string;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  await mongoose.connect(uri);

  const res = await request(app).post('/api/auth/signup').send({
    email: 'test@example.com',
    password: 'secure123',
  });
  token = res.body.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  await Project.deleteMany({});
});

describe('Project API', () => {
  it('should reject unauthenticated project creation', async () => {
    await request(app).post('/api/projects').send({ name: 'Unauth Project' }).expect(401);
  });

  it('should create a new project', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Project', description: 'A test project' })
      .expect(201);

    expect(res.body.project).toHaveProperty('slug', 'my-project');
    expect(res.body.project.name).toBe('My Project');
  });

  it('should not allow duplicate project names per user', async () => {
    await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Same Name' });

    await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Same Name' })
      .expect(409);
  });

  it('should list user projects', async () => {
    await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Project One' });

    await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Project Two' });

    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveLength(2);
  });

  it('should update a project', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Old Name' });

    const projectId = createRes.body.project._id;

    const updateRes = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' })
      .expect(200);

    expect(updateRes.body.project.name).toBe('New Name');
    expect(updateRes.body.project.slug).toBe('new-name');
  });

  it('should delete a project', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'To Delete' });

    const projectId = createRes.body.project._id;

    await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const listRes = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(listRes.body).toHaveLength(0);
  });
});
