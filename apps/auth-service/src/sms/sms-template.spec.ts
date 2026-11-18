import { of } from 'rxjs';
import { SmsService } from './sms.service';

jest.mock('redis-service', () => ({
  redis: { get: jest.fn().mockResolvedValue(null), del: jest.fn().mockResolvedValue(1), on: jest.fn() },
}));

describe('VoiceSMS OTP template', () => {
  it('sends the configured login OTP template', async () => {
    const previousUkey = process.env.VOICESMS_UKEY;
    process.env.VOICESMS_UKEY = 'test-key';
    const http = { get: jest.fn().mockReturnValue(of({ data: { data: { ackid: 'ACK1', msgid: 'M1' } } })) };
    const service = new SmsService(http as any, { add: jest.fn() });
    await service.sendOtpSmsSync('9876543210', '482913');
    const url = new URL(http.get.mock.calls[0][0]);
    expect(url.searchParams.get('message'))
      .toBe('Dear User, 482913 is the OTP for login. Team Alankit.');
    expect(url.searchParams.get('ukey')).toBe('test-key');
    expect(url.searchParams.get('msisdn')).toBe('9876543210');
    expect(url.searchParams.get('senderid')).toBe('ALKIMG');
    expect(url.searchParams.get('templateid')).toBe('0');
    if (previousUkey === undefined) delete process.env.VOICESMS_UKEY;
    else process.env.VOICESMS_UKEY = previousUkey;
  });
});
