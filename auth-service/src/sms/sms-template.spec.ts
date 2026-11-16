import { of } from 'rxjs';
import { SmsService } from './sms.service';

jest.mock('redis-service', () => ({
  redis: { get: jest.fn().mockResolvedValue(null), del: jest.fn().mockResolvedValue(1), on: jest.fn() },
}));

describe('SMS DLT template', () => {
  it('sends the exact DLT-registered OTP text (operators drop any mismatch silently)', async () => {
    const http = { get: jest.fn().mockReturnValue(of({ data: { data: { ackid: 'ACK1', msgid: 'M1' } } })) };
    const service = new SmsService(http as any, { add: jest.fn() });
    await service.sendOtpSmsSync('9876543210', '482913');
    const url = new URL(http.get.mock.calls[0][0]);
    expect(url.searchParams.get('text'))
      .toBe('UnlistedStox Login OTP: 482913. Valid for 10 minutes only. Never share your OTP.');
  });
});
