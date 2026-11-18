import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canRetryOrderPayment, isPaymentExpired } from './order-payment-window.ts';

const created = Date.parse('2026-10-01T00:00:00Z');
const deadline = created + 24 * 60 * 60 * 1000;
const order = { status: 'PENDING', paymentStatus: 'PENDING', createdAt: new Date(created).toISOString(), expiresAt: new Date(deadline).toISOString() };

test('closed, processing, failed and pending checkouts can retry before the deadline', () => {
  for (const paymentStatus of ['PENDING', 'PROCESSING', 'FAILED', 'USER_DROPPED']) {
    assert.equal(canRetryOrderPayment({ ...order, paymentStatus }, deadline - 1), true);
  }
});
test('the button expires exactly at the deadline, without waiting for the sweep', () => {
  assert.equal(canRetryOrderPayment(order, deadline), false);
  assert.equal(isPaymentExpired(order, deadline), true);
});
test('paid, completed, cancelled and expired orders cannot retry', () => {
  for (const status of ['PAID', 'COMPLETED', 'CANCELLED', 'EXPIRED']) {
    assert.equal(canRetryOrderPayment({ ...order, status }, created), false);
  }
  assert.equal(canRetryOrderPayment({ ...order, paymentStatus: 'PAID' }, created), false);
  assert.equal(isPaymentExpired({ ...order, paymentStatus: 'PAID' }, deadline), false);
});
test('legacy stored deadlines are respected and missing deadlines use 24 hours', () => {
  assert.equal(canRetryOrderPayment({ ...order, expiresAt: new Date(created + 1000).toISOString() }, created + 1000), false);
  assert.equal(canRetryOrderPayment({ ...order, expiresAt: null }, deadline - 1), true);
  assert.equal(canRetryOrderPayment({ ...order, expiresAt: null }, deadline), false);
});
