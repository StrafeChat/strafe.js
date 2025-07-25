import { Client } from '../client/Client';
import { Message, User } from '../structure';

/**
 * Handles MESSAGE_CREATE events from Stargate
 * @param client The client instance
 * @param eventData The message data from the event
 */
export function handleMessageCreate(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('MESSAGE_CREATE event missing data');
    return;
  }

  try {
    const room = client.rooms.get(eventData.room_id);
    
    if (!room) {
      console.warn(`MESSAGE_CREATE event: Room ${eventData.room_id} not found in client.rooms`);
      return;
    }
    
    // Add client to author data before creating User instance
    const authorData = { ...eventData.author, client };
    const messageAuthor = new User(authorData);
    
    eventData.room = room;
    eventData.author = messageAuthor;
    eventData.client = client;
    
    const message = new Message(eventData);
    client.emit('messageCreate', message);
  } catch (error) {
    console.error('Error handling MESSAGE_CREATE event:', error);
  }
}

/**
 * Handles MESSAGE_UPDATE events from Stargate
 * @param client The client instance
 * @param eventData The message update data from the event
 */
export function handleMessageUpdate(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('MESSAGE_UPDATE event missing data');
    return;
  }

  try {
    client.emit('messageUpdate', eventData);
  } catch (error) {
    console.error('Error handling MESSAGE_UPDATE event:', error);
  }
}

/**
 * Handles MESSAGE_DELETE events from Stargate
 * @param client The client instance
 * @param eventData The message deletion data from the event
 */
export function handleMessageDelete(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('MESSAGE_DELETE event missing data');
    return;
  }

  try {
    client.emit('messageDelete', eventData);
  } catch (error) {
    console.error('Error handling MESSAGE_DELETE event:', error);
  }
}