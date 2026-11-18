// All security decisions and mutations happen in one Redis operation.
export const TAKE_SIGNUP = `
  local raw = redis.call('GET', KEYS[1])
  if not raw or redis.call('PTTL', KEYS[1]) <= 0 then return nil end
  redis.call('DEL', KEYS[1])
  return raw
`;

export const CONSUME_OTP = `
  if redis.call('EXISTS', KEYS[2]) == 1 then return -2 end
  if ARGV[3] ~= '' then
    local proof = redis.call('GET', KEYS[3])
    if not proof or cjson.decode(proof) ~= ARGV[3] then return -3 end
  end
  local raw = redis.call('GET', KEYS[1])
  local ttl = redis.call('PTTL', KEYS[1])
  if not raw or ttl <= 0 then return -1 end
  local record = cjson.decode(raw)
  if record.otp == ARGV[1] and record.retries < tonumber(ARGV[2]) then
    redis.call('DEL', KEYS[1])
    if ARGV[3] ~= '' then redis.call('DEL', KEYS[3]) end
    return 0
  end
  record.retries = record.retries + 1
  if record.retries >= tonumber(ARGV[2]) then
    redis.call('SET', KEYS[2], 'true', 'EX', 900)
    redis.call('DEL', KEYS[1])
    return -2
  end
  redis.call('SET', KEYS[1], cjson.encode(record), 'PX', ttl)
  return tonumber(ARGV[2]) - record.retries
`;

export const RATE_LIMIT = `
  local count = tonumber(redis.call('GET', KEYS[1]) or '0')
  if count >= tonumber(ARGV[1]) then return 0 end
  count = redis.call('INCR', KEYS[1])
  if redis.call('PTTL', KEYS[1]) < 0 then
    redis.call('EXPIRE', KEYS[1], ARGV[2])
  end
  return 1
`;

export const INCREMENT_COUNTER = `
  local count = redis.call('INCR', KEYS[1])
  if redis.call('PTTL', KEYS[1]) < 0 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return count
`;

export const RELEASE_LOCK = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`;

export const UPDATE_DELIVERY = `
  local raw = redis.call('GET', KEYS[1])
  local ttl = redis.call('PTTL', KEYS[1])
  if not raw or ttl <= 0 then return 0 end
  local record = cjson.decode(raw)
  if record.otp ~= ARGV[1] then return 0 end
  record.deliveryStatus = ARGV[2]
  redis.call('SET', KEYS[1], cjson.encode(record), 'PX', ttl)
  return 1
`;
