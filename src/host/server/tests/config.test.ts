import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import { User } from '../src/models/user.model';
import { Config } from '../src/models/config.model';
import { Project } from '../src/models/project.model';
import slugify from 'slugify';

jest.setTimeout(15000);

let mongo: MongoMemoryServer;
let token: string;
let projectId: string;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  await mongoose.connect(uri);

  const res = await request(app).post('/api/auth/signup').send({
    email: 'cliuser@example.com',
    password: 'cli123',
  });
  token = res.body.token;

  const user = await User.findOne({ email: 'cliuser@example.com' });

  const project = await Project.create({
    name: 'atlas',
    slug: slugify('atlas', { lower: true, strict: true }),
    owner: user!._id,
  });

  projectId = project._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  await Config.deleteMany({});
});

describe('Config CLI API', () => {
  const projectSlug = 'atlas';

  it('should upload a new config version', async () => {
    const res = await request(app)
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
    await Config.create([
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

    const res = await request(app)
      .get(`/api/configs/${projectSlug}/latest`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.version).toBe('1.2.0');
    expect(res.body.config.b).toBe(2);
  });

  it('should fetch a specific config version', async () => {
    await Config.create({
      name: 'atlas',
      version: '2.0.1',
      config: { x: 'y' },
      project: projectId,
    });

    const res = await request(app)
      .get(`/api/configs/${projectSlug}/2.0.1`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.config).toHaveProperty('x', 'y');
  });

  it('should return 404 for missing version', async () => {
    const res = await request(app)
      .get(`/api/configs/${projectSlug}/9.9.9`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(res.body.message).toMatch(/not found/i);
  });

  it('should reject invalid payloads on upload', async () => {
    const res = await request(app)
      .post(`/api/configs/${projectSlug}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'atlas', config: {} })
      .expect(400);

    expect(res.body.message).toMatch(/version/i);
  });
});
