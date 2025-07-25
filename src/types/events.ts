import { Message } from "../structure";
import { ApiError, ClientConfig, IUser } from "./index";

export interface ClientOptions {
  config?: Partial<ClientConfig>;
}

/***
 * @typedef {"READY"} Events
 */
export type Events =
  | "HELLO"
  | "READY"
  | "HEARTBEAT"
  | "IDENTIFY"
  | "MESSAGE_CREATE"
  | "MESSAGE_UPDATE"
  | "MESSAGE_DELETE"
  | "TYPING_INDICATOR"
  | "PRESENCE_UPDATE";

export interface ErrorEvent extends ApiError {}

export interface ReadyEvent {
  user: IUser;
}

export interface TypingEvent {
  channel_id: string;
  user_id: string;
}

export interface EventMap {
  ready: ReadyEvent;
  typingStart: TypingEvent;
  typingStop: TypingEvent;
  typingIndicator: TypingEvent;
  messageCreate: Message;
  messageUpdate: any;
  messageDelete: any;
  spaceCreate: any;
  spaceUpdate: any;
  spaceDelete: any;
  spaceMemberAdd: any;
  spaceMemberRemove: any;
  spaceRoleCreate: any;
  spaceRoleUpdate: any;
  spaceRoleDelete: any;
  spaceMemberRoleUpdate: any;
  roomCreate: any;
  roomUpdate: any;
  roomDelete: any;
  roomMemberAdd: any;
  roomMemberRemove: any;
  roomPositionsUpdate: any;
  roomOwnershipTransfer: any;
  error: ErrorEvent;
  dispatch: any;
}
