import { Client } from '../client/Client';
import { Room } from '../structure';

/**
 * Handles ROOM_CREATE events from Stargate
 * @param client The client instance
 * @param eventData The room data from the event
 */
export function handleRoomCreate(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('ROOM_CREATE event missing data');
    return;
  }

  try {
    const room = new Room(eventData);
    room.client = client;
    client.rooms.set(eventData.id, room);
    client.emit('roomCreate', eventData);
  } catch (error) {
    console.error('Error handling ROOM_CREATE event:', error);
  }
}

/**
 * Handles ROOM_UPDATE events from Stargate
 * @param client The client instance
 * @param eventData The room update data from the event
 */
export function handleRoomUpdate(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('ROOM_UPDATE event missing data');
    return;
  }

  try {
    const roomId = eventData.room_id || eventData.id;
    if (roomId && client.rooms.has(roomId)) {
      const room = client.rooms.get(roomId);
      if (room) {
        // Update room properties
        Object.assign(room, eventData);
      }
    }
    client.emit('roomUpdate', eventData);
  } catch (error) {
    console.error('Error handling ROOM_UPDATE event:', error);
  }
}

/**
 * Handles ROOM_DELETE events from Stargate
 * @param client The client instance
 * @param eventData The room deletion data from the event
 */
export function handleRoomDelete(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('ROOM_DELETE event missing data');
    return;
  }

  try {
    const roomId = eventData.room_id || eventData.id;
    if (roomId && client.rooms.has(roomId)) {
      client.rooms.delete(roomId);
    }
    client.emit('roomDelete', eventData);
  } catch (error) {
    console.error('Error handling ROOM_DELETE event:', error);
  }
}

/**
 * Handles ROOM_MEMBER_ADD events from Stargate
 * @param client The client instance
 * @param eventData The room member addition data from the event
 */
export function handleRoomMemberAdd(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('ROOM_MEMBER_ADD event missing data');
    return;
  }

  try {
    client.emit('roomMemberAdd', eventData);
  } catch (error) {
    console.error('Error handling ROOM_MEMBER_ADD event:', error);
  }
}

/**
 * Handles ROOM_MEMBER_REMOVE events from Stargate
 * @param client The client instance
 * @param eventData The room member removal data from the event
 */
export function handleRoomMemberRemove(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('ROOM_MEMBER_REMOVE event missing data');
    return;
  }

  try {
    client.emit('roomMemberRemove', eventData);
  } catch (error) {
    console.error('Error handling ROOM_MEMBER_REMOVE event:', error);
  }
}

/**
 * Handles ROOM_POSITIONS_UPDATE events from Stargate
 * @param client The client instance
 * @param eventData The room positions update data from the event
 */
export function handleRoomPositionsUpdate(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('ROOM_POSITIONS_UPDATE event missing data');
    return;
  }

  try {
    client.emit('roomPositionsUpdate', eventData);
  } catch (error) {
    console.error('Error handling ROOM_POSITIONS_UPDATE event:', error);
  }
}

/**
 * Handles ROOM_OWNERSHIP_TRANSFER events from Stargate
 * @param client The client instance
 * @param eventData The room ownership transfer data from the event
 */
export function handleRoomOwnershipTransfer(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('ROOM_OWNERSHIP_TRANSFER event missing data');
    return;
  }

  try {
    client.emit('roomOwnershipTransfer', eventData);
  } catch (error) {
    console.error('Error handling ROOM_OWNERSHIP_TRANSFER event:', error);
  }
}