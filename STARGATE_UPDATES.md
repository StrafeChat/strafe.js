# Stargate Integration Updates

This document outlines the changes made to strafe.js to properly integrate with the Stargate WebSocket server.

## Key Changes Made

### 1. Event Structure Alignment

**Before:** strafe.js expected events in the format:
```javascript
{
  data: any,
  type: Events
}
```

**After:** Updated to match Stargate's actual format:
```javascript
{
  op: string,
  d: any
}
```

### 2. Configuration Updates

- **Port Change:** Updated Stargate URL from `ws://localhost:8080` to `ws://localhost:8081`
- **OpCode Fix:** Fixed typo `HEARBEAT` → `HEARTBEAT` in both config and types
- **DISPATCH and MESSAGE Support:** Added `DISPATCH` and `MESSAGE` opcodes to handle general event dispatching from Stargate

### 3. WebSocket Message Handling

- Updated message parsing to use `payload.op` instead of `type`
- Updated data access to use `payload.d` instead of `data`
- Added proper handling for `HEARTBEAT_ACK` events
- Enhanced heartbeat interval handling from server `HELLO` event
- Added DISPATCH event handling to prevent "Unknown event type" errors

## Event Handling

### Added DISPATCH and MESSAGE event handling
- **File**: `src/client/WebsocketClient.ts`
- **Change**: Added cases for `OpCodes.DISPATCH` and `OpCodes.MESSAGE` in WebSocket message handler
- **Details**: 
  - Fixed nested payload structure handling:
    - `MESSAGE` events: `payload.d.d.type` and `payload.d.d.data`
    - `DISPATCH` events with nested MESSAGE operations: `payload.d.d.type` and `payload.d.d.data`
    - Regular `DISPATCH` events: `payload.d.type` and `payload.d.data`
  - This fix resolves the "DISPATCH event missing type" error that occurred when processing both MESSAGE events and DISPATCH events containing MESSAGE operations
  - Extracts `eventType` and `eventData` from nested payload structure
  - Uses dedicated event handler functions for each event type
  - Includes fallback for unknown event types

### Created modular event handlers
- **Files**: 
  - `src/events/index.ts` - Entry point for event handlers
  - `src/events/message.ts` - Handles MESSAGE_CREATE, MESSAGE_UPDATE, MESSAGE_DELETE
  - `src/events/space.ts` - Handles all space-related events
  - `src/events/room.ts` - Handles all room-related events
  - `src/events/typing.ts` - Handles typing indicator events
- **Fixed User Constructor Issue**: Updated `handleMessageCreate` in `message.ts` to properly pass the client instance to User constructor by spreading author data with client property
- **Benefits**:
  - Improved code organization and maintainability
  - Separation of concerns for different event types
  - Easier to add new event handlers
  - Better error handling and logging

### Updated EventMap type definitions
- **File**: `src/types/events.ts`
- **Change**: Added all missing event types to EventMap interface
- **Events Added**: messageUpdate, messageDelete, spaceCreate, spaceUpdate, spaceDelete, spaceMemberAdd, spaceMemberRemove, spaceRoleCreate, spaceRoleUpdate, spaceRoleDelete, spaceMemberRoleUpdate, roomCreate, roomUpdate, roomDelete, roomMemberAdd, roomMemberRemove, roomPositionsUpdate, roomOwnershipTransfer, typingIndicator, dispatch

### 4. Authentication Payload

- Maintained the existing bot token authentication structure
- Ensured compatibility with Stargate's `IdentifyPayload` format

### 5. Heartbeat Improvements

- Dynamic heartbeat interval based on server's `HELLO` event
- Added timestamp to heartbeat payloads
- Proper acknowledgment handling

## Files Modified

1. **`src/config/index.ts`**
   - Updated Stargate URL port
   - Fixed `HEARBEAT` typo in OpCodes enum

2. **`src/types/events.ts`**
   - Fixed `HEARBEAT` typo in Events type

3. **`src/client/WebsocketClient.ts`**
   - Complete refactor of message handling
   - Updated event structure parsing
   - Enhanced heartbeat functionality
   - Added proper error handling

## Testing

A test script (`test-bot.js`) has been created to validate the integration:

```bash
# Build the project
npm run build

# Run the test (replace with actual bot token)
node test-bot.js
```

## Compatibility

These changes ensure full compatibility with:
- Stargate WebSocket server running on port 8081
- MessagePack encoding/decoding
- Bot token authentication
- Real-time event handling (messages, presence updates, etc.)

## Recent Updates

### Fix for Room Null Reference Issue (Latest)
- **Issue**: `TypeError: null is not an object (evaluating 'message.room.send')` when trying to send messages in MESSAGE_CREATE event handler
- **Root Cause**: 
  1. Room was not found in `client.rooms` collection because only rooms within spaces were being processed during READY event
  2. No null check for room before creating Message instance
- **Solution**: 
  1. Added processing of standalone rooms in READY event handler in WebsocketClient.ts
  2. Added null check in `handleMessageCreate` to prevent creating Message with null room
  3. Added explicit client property to eventData before creating Message instance
- **Files Modified**: `src/client/WebsocketClient.ts`, `src/events/message.ts`
- **Status**: ✅ Fixed and verified

### Fix for User Constructor Client Issue
- **Issue**: `TypeError: undefined is not an object (evaluating 'data.client')` in User constructor when handling MESSAGE_CREATE events
- **Root Cause**: The `eventData.author` object passed to the User constructor was missing the required `client` property
- **Solution**: Updated `handleMessageCreate` in `message.ts` to explicitly add the client instance to the author data before creating the User object
- **Files Modified**: `src/events/message.ts`
- **Status**: ✅ Fixed and verified

## Migration Notes

If you're upgrading from a previous version:
1. Update any hardcoded references to port 8080 → 8081
2. Rebuild your project after updating
3. Test your bot connections to ensure proper event handling