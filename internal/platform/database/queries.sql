-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1 LIMIT 1;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1 LIMIT 1;

-- name: CreateUser :one
INSERT INTO users (email, password_hash, role, language, profile_validated, is_premium, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: UpdateUserPassword :exec
UPDATE users SET password_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1;

-- name: UpdateUserLanguage :exec
UPDATE users SET language = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1;

-- name: UpdateUserProfileValidated :exec
UPDATE users SET profile_validated = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1;

-- name: UpdateUserIsPremium :exec
UPDATE users SET is_premium = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1;

-- name: BanUser :exec
UPDATE users SET banned_until = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1;

-- name: UnbanUser :exec
UPDATE users SET banned_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1;

-- name: DeleteUser :exec
DELETE FROM users WHERE id = $1;

-- name: CreateUserSession :one
INSERT INTO user_sessions (user_id, refresh_token_hash, device_info, fcm_token, expires_at, created_at)
VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
RETURNING *;

-- name: GetUserSessionByTokenHash :one
SELECT * FROM user_sessions WHERE refresh_token_hash = $1 LIMIT 1;

-- name: GetUserSessionByID :one
SELECT * FROM user_sessions WHERE id = $1 LIMIT 1;

-- name: DeleteUserSession :exec
DELETE FROM user_sessions WHERE id = $1;

-- name: DeleteUserSessionByTokenHash :exec
DELETE FROM user_sessions WHERE refresh_token_hash = $1;

-- name: DeleteUserSessionsByUserID :exec
DELETE FROM user_sessions WHERE user_id = $1;

-- name: DeleteUserSessionByDeviceID :exec
DELETE FROM user_sessions WHERE user_id = $1 AND id = $2;

-- name: ListUserSessions :many
SELECT * FROM user_sessions WHERE user_id = $1 ORDER BY id DESC;

-- name: UpdateUserSessionDeviceToken :exec
UPDATE user_sessions
SET fcm_token = $2, device_info = COALESCE($3, device_info)
WHERE user_id = $1;

-- name: GetUserDeviceToken :one
SELECT fcm_token, device_info FROM user_sessions
WHERE user_id = $1 AND fcm_token IS NOT NULL AND fcm_token != ''
ORDER BY id DESC LIMIT 1;

-- name: GetProfileByUserID :one
SELECT * FROM profiles WHERE user_id = $1 LIMIT 1;

-- name: UpsertProfile :one
INSERT INTO profiles (
    user_id, first_name, username, phone_number, languages, bio,
    avatar_url, selfie_url, profile_picture_url, is_private, relation_type,
    latitude, longitude, geohash, is_online, last_seen_at, updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10, $11,
    $12, $13, $14, $15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT (user_id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    username = COALESCE(EXCLUDED.username, profiles.username),
    phone_number = COALESCE(EXCLUDED.phone_number, profiles.phone_number),
    languages = COALESCE(EXCLUDED.languages, profiles.languages),
    bio = COALESCE(EXCLUDED.bio, profiles.bio),
    avatar_url = CASE WHEN EXCLUDED.avatar_url != '' THEN EXCLUDED.avatar_url ELSE profiles.avatar_url END,
    selfie_url = COALESCE(EXCLUDED.selfie_url, profiles.selfie_url),
    profile_picture_url = COALESCE(EXCLUDED.profile_picture_url, profiles.profile_picture_url),
    is_private = EXCLUDED.is_private,
    relation_type = COALESCE(EXCLUDED.relation_type, profiles.relation_type),
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geohash = EXCLUDED.geohash,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: UpdateProfilePictureURL :exec
UPDATE profiles SET profile_picture_url = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1;

-- name: UpdateProfilePresence :exec
UPDATE profiles SET is_online = $2, last_seen_at = $3, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1;

-- name: GetDemographicByUserID :one
SELECT * FROM demographics WHERE user_id = $1 LIMIT 1;

-- name: UpsertDemographic :one
INSERT INTO demographics (
    user_id, birth_date, gender, height, weight, degree,
    profession, religion, relation_status, city_id, city_name
) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10, $11
)
ON CONFLICT (user_id) DO UPDATE SET
    birth_date = EXCLUDED.birth_date,
    gender = EXCLUDED.gender,
    height = COALESCE(EXCLUDED.height, demographics.height),
    weight = COALESCE(EXCLUDED.weight, demographics.weight),
    degree = COALESCE(EXCLUDED.degree, demographics.degree),
    profession = COALESCE(EXCLUDED.profession, demographics.profession),
    religion = COALESCE(EXCLUDED.religion, demographics.religion),
    relation_status = COALESCE(EXCLUDED.relation_status, demographics.relation_status),
    city_id = COALESCE(EXCLUDED.city_id, demographics.city_id),
    city_name = COALESCE(EXCLUDED.city_name, demographics.city_name)
RETURNING *;

-- name: GetPreferencesByUserID :one
SELECT * FROM preferences WHERE user_id = $1 LIMIT 1;

-- name: UpsertPreferences :one
INSERT INTO preferences (user_id, relation, drinking, smoking, kids, pets)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (user_id) DO UPDATE SET
    relation = COALESCE(EXCLUDED.relation, preferences.relation),
    drinking = COALESCE(EXCLUDED.drinking, preferences.drinking),
    smoking = COALESCE(EXCLUDED.smoking, preferences.smoking),
    kids = COALESCE(EXCLUDED.kids, preferences.kids),
    pets = COALESCE(EXCLUDED.pets, preferences.pets)
RETURNING *;

-- name: GetPersonalityByUserID :one
SELECT * FROM personalities WHERE user_id = $1 LIMIT 1;

-- name: UpsertPersonality :one
INSERT INTO personalities (user_id, mood, star_sign)
VALUES ($1, $2, $3)
ON CONFLICT (user_id) DO UPDATE SET
    mood = COALESCE(EXCLUDED.mood, personalities.mood),
    star_sign = COALESCE(EXCLUDED.star_sign, personalities.star_sign)
RETURNING *;

-- name: ListUserGalleries :many
SELECT * FROM user_galleries WHERE user_id = $1 ORDER BY id ASC;

-- name: GetUserGalleryByID :one
SELECT * FROM user_galleries WHERE id = $1 LIMIT 1;

-- name: CreateUserGallery :one
INSERT INTO user_galleries (user_id, image_url, description, likes_count, is_profile_picture, created_at)
VALUES ($1, $2, $3, 0, $4, CURRENT_TIMESTAMP)
RETURNING *;

-- name: UpdateUserGallery :one
UPDATE user_galleries
SET image_url = COALESCE($3, image_url),
    description = COALESCE($4, description),
    is_profile_picture = COALESCE($5, is_profile_picture)
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: DeleteUserGallery :exec
DELETE FROM user_galleries WHERE id = $1 AND user_id = $2;

-- name: ClearUserProfilePictures :exec
UPDATE user_galleries SET is_profile_picture = false WHERE user_id = $1;

-- name: SetUserProfilePicture :exec
UPDATE user_galleries SET is_profile_picture = true WHERE id = $1 AND user_id = $2;

-- name: ListUserInterests :many
SELECT ui.id, ui.user_id, ui.interest_id, ui.is_liked,
       i.name_en, i.name_fa, i.media, i.category_id
FROM user_interests ui
JOIN interests i ON ui.interest_id = i.id
WHERE ui.user_id = $1;

-- name: DeleteUserInterests :exec
DELETE FROM user_interests WHERE user_id = $1;

-- name: InsertUserInterest :exec
INSERT INTO user_interests (user_id, interest_id, is_liked)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, interest_id) DO UPDATE SET is_liked = EXCLUDED.is_liked;

-- name: ListUserQuestionAnswers :many
SELECT uqa.id, uqa.user_id, uqa.question_answer_id,
       qa.question_id, qa.answer_en, qa.answer_fa,
       q.name_en as question_name_en, q.name_fa as question_name_fa, q.type as question_type
FROM user_question_answers uqa
JOIN question_answers qa ON uqa.question_answer_id = qa.id
JOIN questions q ON qa.question_id = q.id
WHERE uqa.user_id = $1;

-- name: DeleteUserQuestionAnswers :exec
DELETE FROM user_question_answers WHERE user_id = $1;

-- name: InsertUserQuestionAnswer :exec
INSERT INTO user_question_answers (user_id, question_answer_id)
VALUES ($1, $2)
ON CONFLICT (user_id, question_answer_id) DO NOTHING;

-- Geo queries
-- name: ListCountries :many
SELECT * FROM countries ORDER BY name ASC;

-- name: GetCountryByID :one
SELECT * FROM countries WHERE id = $1 LIMIT 1;

-- name: GetCountryByName :one
SELECT * FROM countries WHERE LOWER(name) = LOWER($1) LIMIT 1;

-- name: ListStatesByCountryID :many
SELECT * FROM states WHERE country_id = $1 ORDER BY name ASC;

-- name: GetStateByID :one
SELECT * FROM states WHERE id = $1 LIMIT 1;

-- name: ListCitiesByStateID :many
SELECT * FROM cities WHERE state_id = $1 ORDER BY name ASC;

-- name: GetCityByID :one
SELECT * FROM cities WHERE id = $1 LIMIT 1;

-- name: GetCityWithStateAndCountry :one
SELECT c.id as city_id, c.name as city_name,
       s.id as state_id, s.name as state_name,
       co.id as country_id, co.name as country_name, co.code as country_code
FROM cities c
JOIN states s ON c.state_id = s.id
JOIN countries co ON s.country_id = co.id
WHERE c.id = $1 LIMIT 1;

-- name: SearchCitiesByName :many
SELECT c.id as city_id, c.name as city_name,
       s.id as state_id, s.name as state_name,
       co.id as country_id, co.name as country_name, co.code as country_code
FROM cities c
JOIN states s ON c.state_id = s.id
JOIN countries co ON s.country_id = co.id
WHERE LOWER(c.name) LIKE LOWER($1)
LIMIT $2;

-- Questions & Interests queries
-- name: ListQuestions :many
SELECT * FROM questions ORDER BY id ASC;

-- name: ListQuestionsByType :many
SELECT * FROM questions WHERE type = $1 ORDER BY id ASC;

-- name: GetQuestionByID :one
SELECT * FROM questions WHERE id = $1 LIMIT 1;

-- name: SearchQuestions :many
SELECT * FROM questions
WHERE LOWER(name_en) LIKE LOWER($1) OR LOWER(name_fa) LIKE LOWER($1)
ORDER BY id ASC;

-- name: CreateQuestion :one
INSERT INTO questions (name_en, name_fa, type, answer_type, icon, icon_alt)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: UpdateQuestion :one
UPDATE questions
SET name_en = COALESCE($2, name_en),
    name_fa = COALESCE($3, name_fa),
    type = COALESCE($4, type),
    icon = COALESCE($5, icon),
    icon_alt = COALESCE($6, icon_alt)
WHERE id = $1
RETURNING *;

-- name: DeleteQuestion :exec
DELETE FROM questions WHERE id = $1;

-- name: ListQuestionAnswersByQuestionID :many
SELECT * FROM question_answers WHERE question_id = $1 ORDER BY id ASC;

-- name: CreateQuestionAnswer :one
INSERT INTO question_answers (question_id, answer_en, answer_fa)
VALUES ($1, $2, $3)
RETURNING *;

-- name: DeleteQuestionAnswersByQuestionID :exec
DELETE FROM question_answers WHERE question_id = $1;

-- name: ListInterestCategories :many
SELECT * FROM interest_categories ORDER BY id ASC;

-- name: ListInterests :many
SELECT * FROM interests ORDER BY id ASC;

-- name: ListInterestsByCategoryID :many
SELECT * FROM interests WHERE category_id = $1 ORDER BY id ASC;

-- name: GetInterestByID :one
SELECT * FROM interests WHERE id = $1 LIMIT 1;

-- name: GetInterestCategoryByID :one
SELECT * FROM interest_categories WHERE id = $1 LIMIT 1;

-- name: CreateInterestCategory :one
INSERT INTO interest_categories (name_en, name_fa, media)
VALUES ($1, $2, $3)
RETURNING *;

-- name: CreateInterest :one
INSERT INTO interests (category_id, name_en, name_fa, media)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- Swipes & Matching queries
-- name: UpsertSwipe :one
INSERT INTO swipes (user_pair_key, from_user_id, to_user_id, direction, created_at)
VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
ON CONFLICT (from_user_id, to_user_id) DO UPDATE SET
    direction = EXCLUDED.direction,
    user_pair_key = EXCLUDED.user_pair_key
RETURNING *;

-- name: GetSwipe :one
SELECT * FROM swipes WHERE from_user_id = $1 AND to_user_id = $2 LIMIT 1;

-- name: CreateMatch :one
INSERT INTO matches (user_one_id, user_two_id, matched_at, is_active)
VALUES ($1, $2, CURRENT_TIMESTAMP, true)
ON CONFLICT (user_one_id, user_two_id) DO UPDATE SET is_active = true
RETURNING *;

-- name: GetMatch :one
SELECT * FROM matches WHERE (user_one_id = $1 AND user_two_id = $2) OR (user_one_id = $2 AND user_two_id = $1) LIMIT 1;

-- name: ListMatchesByUserID :many
SELECT m.*,
       u.id as partner_id, p.first_name as partner_name, p.username as partner_username,
       p.avatar_url as partner_avatar_url, p.profile_picture_url as partner_profile_picture_url,
       p.is_online as partner_is_online, d.city_name as partner_city
FROM matches m
JOIN users u ON (CASE WHEN m.user_one_id = $1 THEN m.user_two_id ELSE m.user_one_id END) = u.id
LEFT JOIN profiles p ON u.id = p.user_id
LEFT JOIN demographics d ON u.id = d.user_id
WHERE (m.user_one_id = $1 OR m.user_two_id = $1) AND m.is_active = true
ORDER BY m.matched_at DESC;

-- name: ListLikesReceivedByUserID :many
SELECT s.*,
       u.id as liker_id, u.email as liker_email,
       p.first_name as liker_name, p.username as liker_username,
       p.avatar_url as liker_avatar_url, p.profile_picture_url as liker_profile_picture_url,
       p.is_online as liker_is_online, d.city_name as liker_city, d.city_id as liker_city_id
FROM swipes s
JOIN users u ON s.from_user_id = u.id
LEFT JOIN profiles p ON u.id = p.user_id
LEFT JOIN demographics d ON u.id = d.user_id
WHERE s.to_user_id = $1 AND s.direction = 'RIGHT'
ORDER BY s.created_at DESC;

-- Anti-join query for feed candidates using NOT EXISTS
-- name: FindFeedCandidatesWithNotExists :many
SELECT u.id, u.email, u.profile_validated, u.is_premium,
       p.first_name, p.username, p.avatar_url, p.profile_picture_url, p.is_online, p.last_seen_at,
       d.birth_date, d.gender, d.city_id, d.city_name
FROM users u
JOIN profiles p ON u.id = p.user_id
JOIN demographics d ON u.id = d.user_id
WHERE u.id != $1
  AND u.profile_validated = true
  AND (u.banned_until IS NULL OR u.banned_until < CURRENT_TIMESTAMP)
  AND d.gender = $2
  AND (p.avatar_url != '' OR p.profile_picture_url IS NOT NULL OR EXISTS (SELECT 1 FROM user_galleries ug WHERE ug.user_id = u.id))
  AND NOT EXISTS (
      SELECT 1 FROM swipes s WHERE s.from_user_id = $1 AND s.to_user_id = u.id
  )
ORDER BY p.is_online DESC, p.last_seen_at DESC, u.id ASC
LIMIT $3;

-- Fallback feed candidates (excluding only self)
-- name: FindFeedCandidatesFallback :many
SELECT u.id, u.email, u.profile_validated, u.is_premium,
       p.first_name, p.username, p.avatar_url, p.profile_picture_url, p.is_online, p.last_seen_at,
       d.birth_date, d.gender, d.city_id, d.city_name
FROM users u
JOIN profiles p ON u.id = p.user_id
JOIN demographics d ON u.id = d.user_id
WHERE u.id != $1
  AND u.profile_validated = true
  AND (u.banned_until IS NULL OR u.banned_until < CURRENT_TIMESTAMP)
  AND d.gender = $2
  AND (p.avatar_url != '' OR p.profile_picture_url IS NOT NULL OR EXISTS (SELECT 1 FROM user_galleries ug WHERE ug.user_id = u.id))
ORDER BY p.is_online DESC, p.last_seen_at DESC, u.id ASC
LIMIT $3;

-- Candidate details for recommendation scoring
-- name: GetCandidateRecommendationProfile :one
SELECT u.id, d.birth_date, d.city_id, pr.relation as relation_preference,
       COALESCE(array_agg(DISTINCT uqa.question_answer_id) FILTER (WHERE uqa.question_answer_id IS NOT NULL), '{}')::int[] as answer_ids,
       COALESCE(array_agg(DISTINCT ui.interest_id) FILTER (WHERE ui.interest_id IS NOT NULL), '{}')::int[] as interest_ids
FROM users u
LEFT JOIN demographics d ON u.id = d.user_id
LEFT JOIN preferences pr ON u.id = pr.user_id
LEFT JOIN user_question_answers uqa ON u.id = uqa.user_id
LEFT JOIN user_interests ui ON u.id = ui.user_id
WHERE u.id = $1
GROUP BY u.id, d.birth_date, d.city_id, pr.relation;

-- Friends queries
-- name: CreateFriendRequest :one
INSERT INTO friend_requests (sender_id, receiver_id, status, created_at, updated_at)
VALUES ($1, $2, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: GetFriendRequestByID :one
SELECT * FROM friend_requests WHERE id = $1 LIMIT 1;

-- name: GetFriendRequestBetween :one
SELECT * FROM friend_requests
WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
LIMIT 1;

-- name: UpdateFriendRequestStatus :one
UPDATE friend_requests
SET status = $2, updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;

-- name: ListFriendRequestsReceived :many
SELECT fr.*,
       u.id as sender_user_id, p.first_name as sender_name, p.username as sender_username,
       p.avatar_url as sender_avatar_url, p.profile_picture_url as sender_profile_picture_url,
       p.is_online as sender_is_online, d.city_name as sender_city
FROM friend_requests fr
JOIN users u ON fr.sender_id = u.id
LEFT JOIN profiles p ON u.id = p.user_id
LEFT JOIN demographics d ON u.id = d.user_id
WHERE fr.receiver_id = $1 AND fr.status = 'PENDING'
ORDER BY fr.created_at DESC;

-- name: ListFriendRequestsSent :many
SELECT fr.*,
       u.id as receiver_user_id, p.first_name as receiver_name, p.username as receiver_username,
       p.avatar_url as receiver_avatar_url, p.profile_picture_url as receiver_profile_picture_url,
       p.is_online as receiver_is_online, d.city_name as receiver_city
FROM friend_requests fr
JOIN users u ON fr.receiver_id = u.id
LEFT JOIN profiles p ON u.id = p.user_id
LEFT JOIN demographics d ON u.id = d.user_id
WHERE fr.sender_id = $1 AND fr.status = 'PENDING'
ORDER BY fr.created_at DESC;

-- name: ListFriendsByUserID :many
SELECT fr.*,
       u.id as friend_id, p.first_name as friend_name, p.username as friend_username,
       p.avatar_url as friend_avatar_url, p.profile_picture_url as friend_profile_picture_url,
       p.is_online as friend_is_online, d.city_name as friend_city
FROM friend_requests fr
JOIN users u ON (CASE WHEN fr.sender_id = $1 THEN fr.receiver_id ELSE fr.sender_id END) = u.id
LEFT JOIN profiles p ON u.id = p.user_id
LEFT JOIN demographics d ON u.id = d.user_id
WHERE (fr.sender_id = $1 OR fr.receiver_id = $1) AND fr.status = 'ACCEPTED'
ORDER BY fr.updated_at DESC;

-- name: DeleteFriendRequestByID :exec
DELETE FROM friend_requests
WHERE id = $1;

-- name: DeleteFriendRequestBetween :exec
DELETE FROM friend_requests
WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1);

-- Consolidated Chat queries
-- name: CreateDirectConversationPair :one
INSERT INTO direct_conversations_by_pair (canonical_pair_key, conversation_id, created_at)
VALUES ($1, $2, CURRENT_TIMESTAMP)
ON CONFLICT (canonical_pair_key) DO NOTHING
RETURNING *;

-- name: GetDirectConversationPair :one
SELECT * FROM direct_conversations_by_pair WHERE canonical_pair_key = $1 LIMIT 1;

-- name: CreateConversation :one
INSERT INTO conversations (conversation_id, conversation_type, created_by, created_at, title, updated_at)
VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, CURRENT_TIMESTAMP)
RETURNING *;

-- name: GetConversationByID :one
SELECT * FROM conversations WHERE conversation_id = $1 LIMIT 1;

-- name: UpdateConversationLastMessage :exec
UPDATE conversations
SET last_message_at = $2,
    last_message_id = $3,
    last_message_sender_id = $4,
    last_message_preview = $5,
    updated_at = CURRENT_TIMESTAMP
WHERE conversation_id = $1;

-- name: AddConversationMember :one
INSERT INTO conversation_members (conversation_id, user_id, joined_at, role)
VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
ON CONFLICT (conversation_id, user_id) DO NOTHING
RETURNING *;

-- name: GetConversationMember :one
SELECT * FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 LIMIT 1;

-- name: ListConversationMembers :many
SELECT * FROM conversation_members WHERE conversation_id = $1 ORDER BY joined_at ASC;

-- name: RemoveConversationMember :exec
DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2;

-- name: CreateMessageIdempotent :one
INSERT INTO message_idempotency (conversation_id, sender_id, client_message_id, message_id, created_at)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (conversation_id, sender_id, client_message_id) DO NOTHING
RETURNING *;

-- name: GetMessageIdempotency :one
SELECT * FROM message_idempotency WHERE conversation_id = $1 AND sender_id = $2 AND client_message_id = $3 LIMIT 1;

-- name: InsertMessage :one
INSERT INTO messages_by_conversation (
    conversation_id, bucket, created_at, message_id, sender_id, content,
    client_message_id, message_type, media_url, duration, attachment_name,
    attachment_size, mime_type
) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10, $11,
    $12, $13
)
RETURNING *;

-- name: ListMessagesByConversationBucket :many
SELECT * FROM messages_by_conversation
WHERE conversation_id = $1 AND bucket = $2
ORDER BY created_at DESC, message_id ASC
LIMIT $3;

-- name: UpsertConversationByUser :exec
INSERT INTO conversations_by_user (
    user_id, last_message_at, conversation_id, conversation_type,
    last_message_preview, last_message_sender_id, title
) VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (user_id, last_message_at, conversation_id) DO UPDATE SET
    last_message_preview = EXCLUDED.last_message_preview,
    last_message_sender_id = EXCLUDED.last_message_sender_id,
    title = EXCLUDED.title;

-- name: ListConversationsByUser :many
SELECT * FROM conversations_by_user
WHERE user_id = $1
ORDER BY last_message_at DESC
LIMIT $2;

-- name: UpsertGroupProfile :one
INSERT INTO group_profiles_by_id (
    conversation_id, owner_id, active, is_private, title, bio,
    gender, minimum_age, maximum_age, subject_id, city_id, avatar,
    created_at, updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10, $11, $12,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT (conversation_id) DO UPDATE SET
    active = EXCLUDED.active,
    is_private = EXCLUDED.is_private,
    title = COALESCE(EXCLUDED.title, group_profiles_by_id.title),
    bio = COALESCE(EXCLUDED.bio, group_profiles_by_id.bio),
    avatar = COALESCE(EXCLUDED.avatar, group_profiles_by_id.avatar),
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: GetGroupProfileByID :one
SELECT * FROM group_profiles_by_id WHERE conversation_id = $1 LIMIT 1;

-- name: UpsertUserPresence :exec
INSERT INTO user_presence (user_id, is_online, last_seen_at)
VALUES ($1, $2, $3)
ON CONFLICT (user_id) DO UPDATE SET
    is_online = EXCLUDED.is_online,
    last_seen_at = EXCLUDED.last_seen_at;

-- name: GetUserPresence :one
SELECT * FROM user_presence WHERE user_id = $1 LIMIT 1;

-- name: GetUserPresenceBatch :many
SELECT * FROM user_presence WHERE user_id = ANY($1::bigint[]);

-- Admin queries
-- name: CountUsersAdmin :one
SELECT COUNT(*) FROM users;

-- name: CountPendingSelfiesAdmin :one
SELECT COUNT(*) FROM profiles WHERE selfie_url IS NOT NULL AND selfie_url != '' AND user_id IN (SELECT id FROM users WHERE profile_validated = false);

-- name: ListUsersAdmin :many
SELECT u.*, p.first_name, p.username, p.avatar_url, p.selfie_url, d.gender, d.birth_date
FROM users u
LEFT JOIN profiles p ON u.id = p.user_id
LEFT JOIN demographics d ON u.id = d.user_id
ORDER BY u.id DESC
LIMIT $1 OFFSET $2;

-- name: ListPendingVerificationsAdmin :many
SELECT u.id, u.email, u.created_at, p.first_name, p.username, p.avatar_url, p.selfie_url, d.gender, d.birth_date
FROM users u
JOIN profiles p ON u.id = p.user_id
LEFT JOIN demographics d ON u.id = d.user_id
WHERE p.selfie_url IS NOT NULL AND p.selfie_url != '' AND u.profile_validated = false
ORDER BY u.id ASC
LIMIT $1 OFFSET $2;

-- name: CountPendingVerificationsAdmin :one
SELECT COUNT(*)
FROM users u
JOIN profiles p ON u.id = p.user_id
WHERE p.selfie_url IS NOT NULL AND p.selfie_url != '' AND u.profile_validated = false;

-- name: ApproveUserVerificationAdmin :exec
UPDATE users SET profile_validated = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1;

-- name: RejectUserVerificationAdmin :exec
UPDATE profiles SET selfie_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1;
