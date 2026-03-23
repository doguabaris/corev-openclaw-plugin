import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import { User } from '../src/models/user.model';

jest.setTimeout(15000);

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  await User.deleteMany({});
});

describe('Auth API', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'secure123',
  };

  it('should sign up a new user', async () => {
    const res = await request(app).post('/api/auth/signup').send(testUser).expect(201);

    expect(res.body.token).toBeDefined();
  });

  it('should not allow duplicate signups', async () => {
    await request(app).post('/api/auth/signup').send(testUser);

    const res = await request(app).post('/api/auth/signup').send(testUser).expect(409);

    expect(res.body.error).toMatch(/already exists/i);
  });

  it('should login with valid credentials', async () => {
    await request(app).post('/api/auth/signup').send(testUser);

    const res = await request(app).post('/api/auth/login').send(testUser).expect(200);

    expect(res.body.token).toBeDefined();
  });

  it('should reject login with wrong password', async () => {
    await request(app).post('/api/auth/signup').send(testUser);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ ...testUser, password: 'wrong' })
      .expect(401);

    expect(res.body.error).toMatch(/invalid/i);
  });

  it('should return user data on /whoami with valid token', async () => {
    const signupRes = await request(app).post('/api/auth/signup').send(testUser);
    const token = signupRes.body.token;

    const res = await request(app)
      .get('/api/auth/whoami')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('email', testUser.email);
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('should reject /whoami with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/whoami')
      .set('Authorization', 'Bearer invalidtoken')
      .expect(401);

    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toMatch('Unauthorized');
  });
});
