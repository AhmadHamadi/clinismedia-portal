const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const leadsRouter = require('../routes/leads');
const User = require('../models/User');
const MetaLead = require('../models/MetaLead');

jest.setTimeout(120000);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/leads', leadsRouter);
  return app;
}

describe('Make.com leads webhook', () => {
  let mongo;
  let app;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await MetaLead.syncIndexes();
    app = createApp();
  });

  afterEach(async () => {
    await User.deleteMany({});
    await MetaLead.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) {
      await mongo.stop();
    }
  });

  async function createCustomer(token = 'a'.repeat(64)) {
    return User.create({
      name: 'Test Clinic',
      username: `clinic-${Date.now()}-${Math.random()}`,
      email: `clinic-${Date.now()}-${Math.random()}@example.com`,
      password: 'password',
      role: 'customer',
      location: 'Toronto',
      webhookToken: token,
    });
  }

  test('returns 400 when customerId is invalid', async () => {
    const res = await request(app)
      .post('/api/leads/webhook/not-an-id')
      .send({ metaLeadId: 'lead-1' });

    expect(res.status).toBe(400);
  });

  test('returns 404 when customer does not exist', async () => {
    const res = await request(app)
      .post(`/api/leads/webhook/${new mongoose.Types.ObjectId()}?token=${'a'.repeat(64)}`)
      .send({ metaLeadId: 'lead-1' });

    expect(res.status).toBe(404);
  });

  test('returns 401 when token is missing or wrong', async () => {
    const customer = await createCustomer();

    const missing = await request(app)
      .post(`/api/leads/webhook/${customer._id}`)
      .send({ metaLeadId: 'lead-1' });
    expect(missing.status).toBe(401);

    const wrong = await request(app)
      .post(`/api/leads/webhook/${customer._id}?token=${'b'.repeat(64)}`)
      .send({ metaLeadId: 'lead-1' });
    expect(wrong.status).toBe(401);
  });

  test('creates a lead from a valid webhook call', async () => {
    const token = 'c'.repeat(64);
    const customer = await createCustomer(token);

    const res = await request(app)
      .post(`/api/leads/webhook/${customer._id}?token=${token}`)
      .send({
        metaLeadId: 'meta-123',
        name: 'Jane Patient',
        email: 'jane@example.com',
        phone: '(289) 778-3717',
        campaignName: 'CDCP',
        formName: 'April Promo',
        pageName: 'Clinic Page',
        submittedAt: '2026-04-24T16:00:00Z',
        fields: { city: 'Oakville' },
      });

    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(false);

    const lead = await MetaLead.findOne({ customerId: customer._id, metaLeadId: 'meta-123' });
    expect(lead).toBeTruthy();
    expect(lead.source).toBe('make-webhook');
    expect(lead.leadInfo.phone).toBe('12897783717');
    expect(lead.campaignName).toBe('CDCP');
  });

  test('accepts Meta/Make field_data arrays and top-level id', async () => {
    const token = 'e'.repeat(64);
    const customer = await createCustomer(token);

    const res = await request(app)
      .post(`/api/leads/webhook/${customer._id}?token=${token}`)
      .send({
        id: 'meta-array-1',
        campaign_name: 'Hamilton Care Dental Leads',
        created_time: '2026-05-19T15:00:00Z',
        field_data: [
          { name: 'full_name', values: ['Alex Test'] },
          { name: 'email', values: ['alex@example.com'] },
          { name: 'phone_number', values: ['905-555-1212'] },
          { name: 'city', values: ['Hamilton'] },
        ],
      });

    expect(res.status).toBe(200);
    const lead = await MetaLead.findOne({ customerId: customer._id, metaLeadId: 'meta-array-1' });
    expect(lead.leadInfo.name).toBe('Alex Test');
    expect(lead.leadInfo.email).toBe('alex@example.com');
    expect(lead.leadInfo.phone).toBe('19055551212');
    expect(lead.leadInfo.fields.city).toBe('Hamilton');
  });

  test('does not duplicate the same customer/metaLeadId', async () => {
    const token = 'd'.repeat(64);
    const customer = await createCustomer(token);
    const url = `/api/leads/webhook/${customer._id}?token=${token}`;

    const first = await request(app).post(url).send({ metaLeadId: 'meta-456', name: 'First' });
    const second = await request(app).post(url).send({ metaLeadId: 'meta-456', name: 'Second' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect(await MetaLead.countDocuments({ customerId: customer._id, metaLeadId: 'meta-456' })).toBe(1);
  });

  test('merges corrected webhook data into an existing meta lead', async () => {
    const token = 'b'.repeat(64);
    const customer = await createCustomer(token);
    const url = `/api/leads/webhook/${customer._id}?token=${token}`;

    await request(app).post(url).send({
      metaLeadId: 'meta-corrected-1',
      name: 'Initial Name',
      fields: { city: 'Hamilton' },
    });

    const second = await request(app).post(url).send({
      metaLeadId: 'meta-corrected-1',
      email: 'corrected@example.com',
      phone: '9055551212',
      campaignName: 'Corrected Campaign',
      fields: { postal_code: 'L8P 1A1' },
    });

    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect(second.body.merged).toBe(true);
    expect(await MetaLead.countDocuments({ customerId: customer._id, metaLeadId: 'meta-corrected-1' })).toBe(1);

    const merged = await MetaLead.findOne({ customerId: customer._id, metaLeadId: 'meta-corrected-1' });
    expect(merged.leadInfo.name).toBe('Initial Name');
    expect(merged.leadInfo.email).toBe('corrected@example.com');
    expect(merged.leadInfo.phone).toBe('19055551212');
    expect(merged.campaignName).toBe('Corrected Campaign');
    expect(merged.leadInfo.fields.city).toBe('Hamilton');
    expect(merged.leadInfo.fields.postal_code).toBe('L8P 1A1');
  });

  test('merges into same-day IMAP lead when webhook arrives later with Meta lead id', async () => {
    const token = 'f'.repeat(64);
    const customer = await createCustomer(token);
    const emailDate = new Date('2026-04-24T13:00:00Z');

    const imapLead = await MetaLead.create({
      customerId: customer._id,
      emailSubject: 'Hamilton Care Dental Leads',
      campaignName: 'Hamilton Care Dental Leads',
      metaLeadId: null,
      leadInfo: {
        name: 'Sam Existing',
        email: 'sam@example.com',
        phone: '19055551234',
        fields: { city: 'Hamilton' },
      },
      emailFrom: 'leads@clinimedia.ca',
      emailDate,
      status: 'new',
      source: 'imap-poller',
    });

    const res = await request(app)
      .post(`/api/leads/webhook/${customer._id}?token=${token}`)
      .send({
        metaLeadId: 'meta-merge-1',
        name: 'Sam Existing',
        email: 'sam@example.com',
        phone: '(905) 555-1234',
        campaignName: 'Hamilton Care Dental Leads',
        submittedAt: '2026-04-24T16:30:00Z',
        fields: { full_name: 'Sam Existing' },
      });

    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
    expect(res.body.merged).toBe(true);
    expect(await MetaLead.countDocuments({ customerId: customer._id })).toBe(1);

    const merged = await MetaLead.findById(imapLead._id);
    expect(merged.metaLeadId).toBe('meta-merge-1');
    expect(merged.source).toBe('make-webhook');
    expect(merged.leadInfo.fields.city).toBe('Hamilton');
    expect(merged.leadInfo.fields.full_name).toBe('Sam Existing');
  });
});
