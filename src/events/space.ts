import { Client } from '../client/Client';
import { Space } from '../structure';

/**
 * Handles SPACE_CREATE events from Stargate
 * @param client The client instance
 * @param eventData The space data from the event
 */
export function handleSpaceCreate(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('SPACE_CREATE event missing data');
    return;
  }

  try {
    const space = new Space(eventData);
    space.client = client;
    client.spaces.set(eventData.id, space);
    client.emit('spaceCreate', eventData);
  } catch (error) {
    console.error('Error handling SPACE_CREATE event:', error);
  }
}

/**
 * Handles SPACE_UPDATE events from Stargate
 * @param client The client instance
 * @param eventData The space update data from the event
 */
export function handleSpaceUpdate(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('SPACE_UPDATE event missing data');
    return;
  }

  try {
    const spaceId = eventData.space_id || eventData.id;
    if (spaceId && client.spaces.has(spaceId)) {
      const space = client.spaces.get(spaceId);
      if (space) {
        // Update space properties
        Object.assign(space, eventData);
      }
    }
    client.emit('spaceUpdate', eventData);
  } catch (error) {
    console.error('Error handling SPACE_UPDATE event:', error);
  }
}

/**
 * Handles SPACE_DELETE events from Stargate
 * @param client The client instance
 * @param eventData The space deletion data from the event
 */
export function handleSpaceDelete(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('SPACE_DELETE event missing data');
    return;
  }

  try {
    const spaceId = eventData.space_id || eventData.id;
    if (spaceId && client.spaces.has(spaceId)) {
      client.spaces.delete(spaceId);
    }
    client.emit('spaceDelete', eventData);
  } catch (error) {
    console.error('Error handling SPACE_DELETE event:', error);
  }
}

/**
 * Handles SPACE_MEMBER_ADD events from Stargate
 * @param client The client instance
 * @param eventData The space member addition data from the event
 */
export function handleSpaceMemberAdd(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('SPACE_MEMBER_ADD event missing data');
    return;
  }

  try {
    client.emit('spaceMemberAdd', eventData);
  } catch (error) {
    console.error('Error handling SPACE_MEMBER_ADD event:', error);
  }
}

/**
 * Handles SPACE_MEMBER_REMOVE events from Stargate
 * @param client The client instance
 * @param eventData The space member removal data from the event
 */
export function handleSpaceMemberRemove(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('SPACE_MEMBER_REMOVE event missing data');
    return;
  }

  try {
    client.emit('spaceMemberRemove', eventData);
  } catch (error) {
    console.error('Error handling SPACE_MEMBER_REMOVE event:', error);
  }
}

/**
 * Handles SPACE_ROLE_CREATE events from Stargate
 * @param client The client instance
 * @param eventData The space role creation data from the event
 */
export function handleSpaceRoleCreate(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('SPACE_ROLE_CREATE event missing data');
    return;
  }

  try {
    client.emit('spaceRoleCreate', eventData);
  } catch (error) {
    console.error('Error handling SPACE_ROLE_CREATE event:', error);
  }
}

/**
 * Handles SPACE_ROLE_UPDATE events from Stargate
 * @param client The client instance
 * @param eventData The space role update data from the event
 */
export function handleSpaceRoleUpdate(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('SPACE_ROLE_UPDATE event missing data');
    return;
  }

  try {
    client.emit('spaceRoleUpdate', eventData);
  } catch (error) {
    console.error('Error handling SPACE_ROLE_UPDATE event:', error);
  }
}

/**
 * Handles SPACE_ROLE_DELETE events from Stargate
 * @param client The client instance
 * @param eventData The space role deletion data from the event
 */
export function handleSpaceRoleDelete(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('SPACE_ROLE_DELETE event missing data');
    return;
  }

  try {
    client.emit('spaceRoleDelete', eventData);
  } catch (error) {
    console.error('Error handling SPACE_ROLE_DELETE event:', error);
  }
}

/**
 * Handles SPACE_MEMBER_ROLE_UPDATE events from Stargate
 * @param client The client instance
 * @param eventData The space member role update data from the event
 */
export function handleSpaceMemberRoleUpdate(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('SPACE_MEMBER_ROLE_UPDATE event missing data');
    return;
  }

  try {
    client.emit('spaceMemberRoleUpdate', eventData);
  } catch (error) {
    console.error('Error handling SPACE_MEMBER_ROLE_UPDATE event:', error);
  }
}