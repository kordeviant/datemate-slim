/**
 * A user's relationship to a group. Only ACTIVE users are conversation
 * members and therefore allowed to read or send messages.
 */
export enum GroupMembershipStatus {
  ACTIVE = "active",
  PENDING = "pending",
  INVITED = "invited",
  BANNED = "banned",
}
