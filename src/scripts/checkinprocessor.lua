-- Example call from Redis
-- EVALSHA <sha> 2 user_hash_key location_hash_key timestamp location_id star_rating

local userKey = KEYS[1]
local locationKey = KEYS[2]
local checkinTimestamp = ARGV[1]
local checkinLocationId = ARGV[2]
local checkinStarRating = ARGV[3]

-- If the supplied timestamp is greater than the stored lastCheckin
-- timestamp, update it and the lastSeenAt field too.  If there isn't 
-- a current lastCheckin timestamp, use the value provided.
local currentLastCheckin = redis.call('hget', userKey, 'lastCheckin')

if ((currentLastCheckin == false or currentLastCheckin == nil)) or (tonumber(checkinTimestamp) > tonumber(currentLastCheckin)) then
    -- Update lastCheckin and lastSeenAt fields.
    redis.call('hset', userKey, 'lastCheckin', checkinTimestamp, 'lastSeenAt', checkinLocationId)
end

-- Increment the user's numCheckins and the location's numCheckins.
redis.call('hincrby', userKey, 'numCheckins', 1)
local locationNumCheckins = redis.call('hincrby', locationKey, 'numCheckins', 1)

-- Update the location's total star count.
local locationNumStars = redis.call('hincrby', locationKey, 'numStars', tonumber(checkinStarRating))

-- Calculate and store the location's new average star count.
local newAverageStars = math.floor((locationNumStars / locationNumCheckins) + 0.5)
redis.call('hset', locationKey, 'averageStars', tonumber(newAverageStars))
