-- PollVote: user_id foreign key with cascade delete
ALTER TABLE "poll_votes"
  ADD CONSTRAINT "poll_votes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- PollVote: user_id index
CREATE INDEX "poll_votes_user_id_idx" ON "poll_votes" ("user_id");

-- CommentThreadMute: user_id index
CREATE INDEX "comment_thread_mutes_user_id_idx" ON "comment_thread_mutes" ("user_id");

-- Notification: (user_id, type) composite index
CREATE INDEX "notifications_user_id_type_idx" ON "notifications" ("user_id", "type");

-- FollowRequest: (target_id, status) composite index
CREATE INDEX "follow_requests_target_id_status_idx" ON "follow_requests" ("target_id", "status");
