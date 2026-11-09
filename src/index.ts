// Public exports of @strafechat/strafe.js. Everything a user may import is listed here; anything
// else is internal and not covered by semver.

// Utilities
export * from './util/Collection.js';
export * from './util/BitField.js';
export * from './util/PermissionsBitField.js';
export * from './util/Snowflake.js';
export * from './util/Formatters.js';
export * from './util/instance.js';
export * from './util/invite.js';
export { TypedEmitter, type Listener } from './util/EventEmitter.js';
export { version } from './util/version.js';

// Errors
export * from './errors/ErrorCodes.js';
export * from './errors/StrafeError.js';
export * from './errors/APIErrors.js';

// REST
export { REST, DefaultRestOptions } from './rest/REST.js';
export { Routes, routeTemplate, majorParameter, reactionEmojiSegment } from './rest/Routes.js';
export { buildFormData, toBlob, bigintReplacer } from './rest/multipart.js';
export * from './rest/types.js';

// Wire types
export * from './types/api/index.js';

// Builders
export * from './builders/Colors.js';
export { EmbedBuilder, EmbedLimits, validateEmbed, validateEmbeds, type EmbedAuthorOptions, type EmbedFooterOptions, type EmbedData } from './builders/EmbedBuilder.js';
export * from './builders/AttachmentBuilder.js';

// More utilities
export * from './util/Options.js';
export * from './util/UserFlagsBitField.js';
export { resolveFile, contentTypeFor, type BufferResolvable, type ResolvedFile } from './util/DataResolver.js';
export { normalizeArray, isJSONEncodable, codePointLength, type If, type Awaitable, type RestOrArray, type JSONEncodable } from './util/Util.js';
export { BulkDeleteError } from './errors/BulkDeleteError.js';

// Client
export { Client, type ClientApplication, type ClientOptions, type ClientOptionsResolved } from './client/Client.js';
export {
  WebSocketManager,
  Status,
  DefaultWebSocketOptions,
  type ClientWebSocketOptions,
  type ResolvedWebSocketOptions,
  type WebSocketConstructorLike,
  type WebSocketInitLike,
} from './gateway/WebSocketManager.js';
export { Events, type ClientEvents, type RoomPinsUpdateDetails } from './client/ClientEvents.js';

// Structures
export { Base } from './structures/Base.js';
export { User, type APIUserLike, type ImageURLOptions } from './structures/User.js';
export { ClientUser, type ClientUserEditOptions, type ActivityOptions, type PresenceData } from './structures/ClientUser.js';
export { Presence, Activity, ActivityType, type ActivityTypeString } from './structures/Presence.js';
export { Space, SpaceSystemRoomFlagsBitField, type SpaceSystemRoomFlagsString, type SpaceEditOptions, type FetchAuditLogsOptions } from './structures/Space.js';
export { SpaceMember, type PartialSpaceMember, type APIMemberLike } from './structures/SpaceMember.js';
export { Role, type RoleTags, type RoleResolvable } from './structures/Role.js';
export { PermissionOverwrites, OverwriteType, type PermissionOverwriteOptions, type ResolvedOverwriteOptions } from './structures/PermissionOverwrites.js';
export * from './structures/rooms/index.js';
export { Message, SystemSenderId, type PartialMessage, type MessageReference, type MessageSystemData } from './structures/Message.js';
export { MessageMentions, type MessageMentionsHasOptions } from './structures/MessageMentions.js';
export { MessageReaction } from './structures/MessageReaction.js';
export {
  Collector,
  type CollectorFilter,
  type CollectorOptions,
  type CollectorResetTimerOptions,
  type CollectorEventsMap,
} from './structures/Collector.js';
export { MessageCollector, type MessageCollectorOptions, type AwaitMessagesOptions } from './structures/MessageCollector.js';
export { ReactionCollector, type ReactionCollectorOptions, type AwaitReactionsOptions } from './structures/ReactionCollector.js';
export {
  MaxMessageLength,
  MaxMessageAttachments,
  resolveEmbeds,
  resolveMessageCreate,
  resolveMessageEdit,
  type BaseMessageOptions,
  type MessageCreateOptions,
  type MessageReplyOptions,
  type MessageEditOptions,
  type ReplyOptions,
  type EmbedResolvable,
  type FileResolvable,
  type MessageResolvable,
  type ResolvedMessage,
} from './structures/MessagePayload.js';
export { MaxBulkDelete } from './structures/rooms/TextBased.js';
export { Emoji, SpaceEmoji, ReactionEmoji, type EmojiIdentifierResolvable } from './structures/Emoji.js';
export { Attachment } from './structures/Attachment.js';
export { Embed, type EmbedAuthorData, type EmbedFooterData, type EmbedAssetData } from './structures/Embed.js';
export { Invite } from './structures/Invite.js';
export { SpaceBan } from './structures/SpaceBan.js';
export { AuditLogEntry, SpaceAuditLogs, type AuditLogChange } from './structures/AuditLog.js';
export { VoiceState } from './structures/VoiceState.js';
export { ThreadMember } from './structures/ThreadMember.js';
export { Typing } from './structures/Typing.js';

// Managers
export { BaseManager, DataManager, CachedManager } from './managers/BaseManager.js';
export * from './managers/SpaceManager.js';
export * from './managers/RoomManager.js';
export * from './managers/UserManager.js';
export * from './managers/ClientEmojiManager.js';
export * from './managers/SpaceRoomManager.js';
export * from './managers/SpaceMemberManager.js';
export * from './managers/SpaceMemberRoleManager.js';
export * from './managers/RoleManager.js';
export * from './managers/SpaceBanManager.js';
export * from './managers/SpaceInviteManager.js';
export * from './managers/SpaceEmojiManager.js';
export * from './managers/MessageManager.js';
export * from './managers/ReactionManager.js';
export * from './managers/ReactionUserManager.js';
export * from './managers/PermissionOverwriteManager.js';
export * from './managers/ThreadManager.js';
export * from './managers/ThreadMemberManager.js';
export * from './managers/VoiceStateManager.js';

// OAuth2
export * from './oauth2/index.js';
