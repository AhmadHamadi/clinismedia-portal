const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('../services/emailService', () => ({
  sendAiReceptionistMissedCallEmail: jest.fn().mockResolvedValue(undefined),
}));

const retellRouter = require('../routes/retell');
const EmailService = require('../services/emailService');
const User = require('../models/User');
const RetellCall = require('../models/RetellCall');

jest.setTimeout(120000);

const RETELL_WEBHOOK_KEY = 'test-retell-webhook-key';

function createApp() {
  const app = express();
  app.use('/api/retell/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());
  app.use('/api/retell', retellRouter);
  return app;
}

function signRetellPayload(rawBody) {
  const timestamp = Date.now();
  const digest = crypto
    .createHmac('sha256', RETELL_WEBHOOK_KEY)
    .update(`${rawBody}${timestamp}`, 'utf8')
    .digest('hex');

  return `v=${timestamp},d=${digest}`;
}

describe('Retell webhook', () => {
  let mongo;
  let app;

  beforeAll(async () => {
    process.env.RETELL_WEBHOOK_KEY = RETELL_WEBHOOK_KEY;
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    app = createApp();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await User.deleteMany({});
    await RetellCall.deleteMany({});
  });

  afterAll(async () => {
    delete process.env.RETELL_WEBHOOK_KEY;
    await mongoose.disconnect();
    if (mongo) {
      await mongo.stop();
    }
  });

  async function createCustomer() {
    return User.create({
      name: 'Test Dental',
      username: `clinic-${Date.now()}-${Math.random()}`,
      email: `clinic-${Date.now()}-${Math.random()}@example.com`,
      password: 'password',
      role: 'customer',
      location: 'Toronto',
      twilioPhoneNumber: '+12895550123',
      aiReceptionistSettings: {
        enabled: true,
        provider: 'retell',
        routingMode: 'always_ai',
        telephonyMode: 'sip_uri',
        retellAgentId: 'agent-test',
        retellSipUri: 'sip:agent-test@sip.retellai.com',
        timezone: 'America/Toronto',
      },
    });
  }

  test('does not store caller email from analyzed Retell calls', async () => {
    const customer = await createCustomer();
    const payload = {
      event: 'call_analyzed',
      call: {
        call_id: 'retell-call-no-email',
        agent_id: 'agent-test',
        call_type: 'phone_call',
        direction: 'inbound',
        from_number: '+19055550100',
        to_number: '+12895550123',
        call_status: 'ended',
        start_timestamp: '2026-05-25T14:00:00.000Z',
        end_timestamp: '2026-05-25T14:03:00.000Z',
        duration_ms: 180000,
        recording_url: 'https://example.com/recording.mp3',
        metadata: {
          customerId: String(customer._id),
          twilioCallSid: 'CAretell123',
          customerEmail: 'caller@example.com',
        },
        retell_llm_dynamic_variables: {
          patient_email: 'caller@example.com',
        },
        collected_dynamic_variables: {
          email: 'caller@example.com',
        },
        custom_sip_headers: {
          'X-Caller-Email': 'caller@example.com',
        },
        call_analysis: {
          call_summary: 'Caller asked about booking a cleaning.',
          caller_name: 'Taylor Patient',
          email: 'caller@example.com',
          voicemail: 'Caller left a voicemail-style handoff note.',
          custom_analysis_data: {
            email_address: 'caller@example.com',
          },
          callback_number: '+19055550100',
          reason_for_call: 'Cleaning appointment',
          urgency_level: 'normal',
        },
      },
    };
    const rawBody = JSON.stringify(payload);

    const res = await request(app)
      .post('/api/retell/webhook')
      .set('Content-Type', 'application/json')
      .set('x-retell-signature', signRetellPayload(rawBody))
      .send(rawBody);

    expect(res.status).toBe(204);

    const savedCall = await RetellCall.findOne({ retellCallId: 'retell-call-no-email' }).lean();
    expect(savedCall).toBeTruthy();
    expect(String(savedCall.customerId)).toBe(String(customer._id));
    expect(savedCall.callAnalysis.email).toBeUndefined();
    expect(savedCall.callAnalysis.raw.email).toBeUndefined();
    expect(savedCall.callAnalysis.raw.voicemail).toBe('Caller left a voicemail-style handoff note.');
    expect(savedCall.callAnalysis.raw.custom_analysis_data.email_address).toBeUndefined();
    expect(savedCall.rawCall.call_analysis.email).toBeUndefined();
    expect(savedCall.rawCall.call_analysis.custom_analysis_data.email_address).toBeUndefined();
    expect(savedCall.metadata.customerEmail).toBeUndefined();
    expect(savedCall.retellLlmDynamicVariables.patient_email).toBeUndefined();
    expect(savedCall.collectedDynamicVariables.email).toBeUndefined();
    expect(savedCall.customSipHeaders['X-Caller-Email']).toBeUndefined();
    expect(savedCall.callAnalysis.callerName).toBe('Taylor Patient');
    expect(savedCall.callAnalysis.callbackNumber).toBe('+19055550100');
    expect(EmailService.sendAiReceptionistMissedCallEmail).toHaveBeenCalledTimes(1);
  });

  test('maps phone-number-mode Retell webhooks back to the clinic Retell number', async () => {
    const customer = await createCustomer();
    customer.aiReceptionistSettings.telephonyMode = 'phone_number';
    customer.aiReceptionistSettings.retellPhoneNumber = '+18885550123';
    await customer.save();

    const payload = {
      event: 'call_analyzed',
      call: {
        call_id: 'retell-call-phone-number-mode',
        agent_id: 'agent-test',
        call_type: 'phone_call',
        direction: 'inbound',
        from_number: '+19055550100',
        to_number: '+18885550123',
        call_status: 'ended',
        start_timestamp: '2026-05-25T15:00:00.000Z',
        duration_ms: 90000,
        call_analysis: {
          call_summary: 'Caller asked for office hours.',
          caller_name: 'Jordan Patient',
          callback_number: '+19055550100',
        },
      },
    };
    const rawBody = JSON.stringify(payload);

    const res = await request(app)
      .post('/api/retell/webhook')
      .set('Content-Type', 'application/json')
      .set('x-retell-signature', signRetellPayload(rawBody))
      .send(rawBody);

    expect(res.status).toBe(204);

    const savedCall = await RetellCall.findOne({ retellCallId: 'retell-call-phone-number-mode' }).lean();
    expect(savedCall).toBeTruthy();
    expect(String(savedCall.customerId)).toBe(String(customer._id));
  });

  test('still acknowledges Retell webhook when clinic notification email fails', async () => {
    const customer = await createCustomer();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    EmailService.sendAiReceptionistMissedCallEmail.mockRejectedValueOnce(new Error('SMTP unavailable'));

    const payload = {
      event: 'call_analyzed',
      call: {
        call_id: 'retell-call-email-failure',
        agent_id: 'agent-test',
        call_type: 'phone_call',
        direction: 'inbound',
        from_number: '+19055550100',
        to_number: '+12895550123',
        call_status: 'ended',
        start_timestamp: '2026-05-25T16:00:00.000Z',
        duration_ms: 60000,
        metadata: {
          customerId: String(customer._id),
        },
        call_analysis: {
          call_summary: 'Caller requested a callback.',
          callback_number: '+19055550100',
        },
      },
    };
    const rawBody = JSON.stringify(payload);

    const res = await request(app)
      .post('/api/retell/webhook')
      .set('Content-Type', 'application/json')
      .set('x-retell-signature', signRetellPayload(rawBody))
      .send(rawBody);

    expect(res.status).toBe(204);

    const savedCall = await RetellCall.findOne({ retellCallId: 'retell-call-email-failure' }).lean();
    expect(savedCall).toBeTruthy();
    expect(String(savedCall.customerId)).toBe(String(customer._id));
    expect(savedCall.aiReceptionEmailSentAt).toBeNull();
    consoleErrorSpy.mockRestore();
  });
});
