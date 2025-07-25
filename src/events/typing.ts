import { Client } from '../client/Client';

/**
 * Handles TYPING_INDICATOR events from Stargate
 * @param client The client instance
 * @param eventData The typing indicator data from the event
 */
export function handleTypingIndicator(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('TYPING_INDICATOR event missing data');
    return;
  }

  try {
    client.emit('typingIndicator', eventData);
  } catch (error) {
    console.error('Error handling TYPING_INDICATOR event:', error);
  }
}

/**
 * Handles TYPING_START events from Stargate
 * @param client The client instance
 * @param eventData The typing start data from the event
 */
export function handleTypingStart(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('TYPING_START event missing data');
    return;
  }

  try {
    client.emit('typingStart', eventData);
  } catch (error) {
    console.error('Error handling TYPING_START event:', error);
  }
}

/**
 * Handles TYPING_STOP events from Stargate
 * @param client The client instance
 * @param eventData The typing stop data from the event
 */
export function handleTypingStop(client: Client, eventData: any): void {
  if (!eventData) {
    console.warn('TYPING_STOP event missing data');
    return;
  }

  try {
    client.emit('typingStop', eventData);
  } catch (error) {
    console.error('Error handling TYPING_STOP event:', error);
  }
}